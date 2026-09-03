import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

import { uploadImageToLineBucket } from '../../../../lib/line-image-upload';

export const runtime = 'nodejs';

/**
 * 結果報告文書（テキスト）とビフォー・アフター比較画像（最大4枚）を、
 * 1回の LINE push でまとめて患者に送る。
 * LINE Messaging API は1回の push で最大5メッセージまで送れるため、
 * テキスト1件 + 画像最大4件で収まる構成にしている。
 *
 * 必要な環境変数は /api/line/push-image と同じ。
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

    const body = (await request.json()) as { lineUserId?: string; text?: string; imageDataUrls?: string[] };
    const lineUserId = typeof body.lineUserId === 'string' ? body.lineUserId.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const imageDataUrls = Array.isArray(body.imageDataUrls) ? body.imageDataUrls.filter((s) => typeof s === 'string') : [];
    if (!lineUserId || !text) {
      return NextResponse.json({ error: 'lineUserId と text が必要です' }, { status: 400 });
    }
    if (imageDataUrls.length > 4) {
      return NextResponse.json({ error: '画像は最大4枚までです（1回のpushで最大5メッセージのため）' }, { status: 400 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: 'テキストが長すぎます（5000文字以下）' }, { status: 400 });
    }

    type LineMessage =
      | { type: 'text'; text: string }
      | { type: 'image'; originalContentUrl: string; previewImageUrl: string };
    const messages: LineMessage[] = [{ type: 'text', text }];

    if (imageDataUrls.length > 0) {
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
      for (const imageDataUrl of imageDataUrls) {
        try {
          const publicUrl = await uploadImageToLineBucket(admin, imageDataUrl);
          messages.push({ type: 'image', originalContentUrl: publicUrl, previewImageUrl: publicUrl });
        } catch (e) {
          const message = e instanceof Error ? e.message : 'アップロードに失敗しました';
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
    }

    const pushRes = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });

    if (!pushRes.ok) {
      const errText = await pushRes.text();
      return NextResponse.json({ error: `LINE API: ${errText}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
