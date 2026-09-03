import { randomUUID } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * PNG/JPEG/WebP の Data URL を Supabase Storage（公開バケット `line-push`）に
 * アップロードし、公開URLを返す。LINE Messaging API の image メッセージは
 * 公開URLでの参照が必要なため。
 */
export async function uploadImageToLineBucket(admin: SupabaseClient, imageDataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/i.exec(imageDataUrl);
  if (!match) {
    throw new Error('PNG / JPEG / WebP の Data URL のみ対応しています');
  }
  const kind = match[1].toLowerCase();
  const ext = kind === 'jpeg' || kind === 'jpg' ? 'jpg' : kind === 'webp' ? 'webp' : 'png';
  const contentType = ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('画像が大きすぎます（10MB以下）');
  }

  const objectPath = `push/${Date.now()}-${randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('line-push').upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });
  if (uploadError) {
    throw new Error(`${uploadError.message}（バケット line-push が存在し公開URLが有効か確認してください）`);
  }

  const { data: urlData } = admin.storage.from('line-push').getPublicUrl(objectPath);
  return urlData.publicUrl;
}
