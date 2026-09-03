import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { uploadImageToLineBucket } from '../../../../lib/line-image-upload';

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
    let publicUrl: string;
    try {
      publicUrl = await uploadImageToLineBucket(admin, imageDataUrl);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'アップロードに失敗しました';
      return NextResponse.json({ error: message }, { status: 400 });
    }

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
