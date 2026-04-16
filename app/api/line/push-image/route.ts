import { randomUUID } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 生成画像を一時的に Supabase Storage（公開バケット）に置き、
 * LINE Messaging API の push で患者の userId に送る。
 *
 * 必要な環境変数:
 * - LINE_CHANNEL_ACCESS_TOKEN … LINE Developers のチャネルアクセストークン（長期）
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY … Storage へのアップロード用（サーバーのみ）
 *
 * Supabase: バケット名 `line-push` を作成し「Public bucket」にする。
 */
export async function POST(request: Request) {
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'サーバーに LINE_CHANNEL_ACCESS_TOKEN を設定してください（LINE Developers → Messaging API）。' },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { lineUserId?: string; imageDataUrl?: string };
    const lineUserId = typeof body.lineUserId === 'string' ? body.lineUserId.trim() : '';
    const imageDataUrl = typeof body.imageDataUrl === 'string' ? body.imageDataUrl : '';
    if (!lineUserId || !imageDataUrl) {
      return NextResponse.json({ error: 'lineUserId と imageDataUrl が必要です' }, { status: 400 });
    }

    const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(imageDataUrl);
    if (!match) {
      return NextResponse.json({ error: 'PNG / JPEG / WebP の Data URL のみ対応しています' }, { status: 400 });
    }
    const kind = match[1].toLowerCase();
    const ext = kind === 'jpeg' || kind === 'jpg' ? 'jpg' : kind === 'webp' ? 'webp' : 'png';
    const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '画像が大きすぎます（10MB以下）' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY を .env に追加し、Supabase で公開バケット line-push を作成してください。',
        },
        { status: 501 },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const objectPath = `push/${Date.now()}-${randomUUID()}.${ext}`;
    const { error: uploadError } = await admin.storage.from('line-push').upload(objectPath, buffer, {
      contentType,
      upsert: false,
    });

    if (uploadError) {
      return NextResponse.json(
        {
          error: uploadError.message,
          hint: 'バケット line-push が存在し、公開URLが有効か確認してください。',
        },
        { status: 500 },
      );
    }

    const { data: urlData } = admin.storage.from('line-push').getPublicUrl(objectPath);
    const publicUrl = urlData.publicUrl;

    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [
          {
            type: 'image',
            originalContentUrl: publicUrl,
            previewImageUrl: publicUrl,
          },
        ],
      }),
    });

    if (!pushRes.ok) {
      const text = await pushRes.text();
      return NextResponse.json({ error: `LINE API: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
