import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * LINE Messaging API の Webhook URL 検証用。
 * Developers コンソールの「検証」は主に POST で届く。200 を返せば接続確認として通る。
 * （308 が出る場合は Webhook URL が http になっていないか、末尾スラッシュの有無を確認してください）
 */
export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}

export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
