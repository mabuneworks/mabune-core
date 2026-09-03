import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * クライアント向け結果報告文書を生成する。
 *
 * このアプリの「マスタープロトコル」文書（The Formula: 美の偏差値）が定義する
 * D = 140 − 4S のスコアリング・10項目の判定・区切り点（57.0点/50.0点/40.0点）を
 * そのまま前提として使い、その文書自身が定めている
 * 「患者向けですます報告」（実務者向けデバッグログとは別の、丁寧な文体の報告書）
 * のフォーマットに沿った文章だけをAIに生成させる。
 *
 * 施術者は生成結果を必ず確認・編集してから患者に送る想定（画面側で編集可能にする）。
 */

const SYSTEM_PROMPT = `あなたは、姿勢計測の結果を患者向けに報告する文章を書くアシスタントです。

# 採点の仕組み（前提知識。数値の再計算はしないこと）
- 10項目（顔・肩上・ウエスト・AS・大転子・肘・肩・耳・肩内旋左・肩内旋右）を、それぞれ
  レベル1.0（完璧・逸脱なし）〜5.0（最大変形）の0.5刻みで判定する。
- 合計点(S) = 10項目のレベル合計。最終偏差値(D) = 140 − 4S。
  100点が完璧、点数が低いほど設計図（理想の姿勢）からの逸脱が大きい。
- スコアの目安：57.0点＝「一生モノの姿勢」の境界線（これを下回らなければ慢性的な
  肩こり・腰痛とは縁遠い）。50.0点＝慢性不調の分岐点。40.0点＝マイナス評価域。

# あなたが書く文章：患者向けですます報告
以下の4見出しの構成で、です・ます調の日本語のみを出力すること（見出し以外の前置き・
断り書き・AIである旨の説明などは一切書かない）。

**姿勢計測レポート**

**■ 計測結果**
　施術前：◯◯点
　施術後：◯◯点
（この2行は与えられた数値をそのまま使う）

**■ 判定**
57.0点の境界線・50.0点の分岐点を踏まえ、施術後の点数がどの位置にあるか、
境界線まであと何点か、を短く述べる。

**■ 変化のあった項目**
Before/Afterでレベルが変化した項目を、個別に列挙するのではなく、体の構造として
自然につながる文章でまとめる。例えば骨盤のねじれ（AS）が強いと、その上に乗る
背骨・肩・首の左右バランスが連動して崩れやすい、大転子・耳・肩内旋のような
前後方向のズレは同じ「くるぶし垂直線からの逸脱」という軸で語れる、といった
身体構造上の関連性を踏まえて、どこがどう変化したかを説明すること。
数値（cmの目安）は、説明の助けになる場合にのみ、1〜2箇所程度、自然に触れてよい
（すべての項目に数値を付ける必要はない）。

**■ 残っている課題**
Before/Afterのいずれかで、まだレベル2.0を超えている（＝逸脱が残っている）項目を、
関連する部位ごとにグルーピングして列挙する。改善はしたが完全ではない項目は
「大きく戻りましたが、まだ軽度残っています」のように述べてよい。

# 厳守事項
- 「素晴らしい」「劇的」「感動的」等の情緒的な誉め言葉は一切使わないこと。
- 「健康的で良いですね」等の主観的評価、「ストレッチをしましょう」等の一般的な
  健康指導、歪みを肯定するような解釈は書かないこと。
- 医学的診断（病名の断定など）は書かないこと。事実（数値・変化）の報告に徹すること。
- 出力は日本語の報告文のみ。見出しの装飾（**太字**）は保持すること。マークダウンの
  それ以外の記法（コードブロック等）は使わないこと。`;

interface ReportItem {
  key: string;
  label: string;
  level: number;
  side?: string;
  type?: string;
  approxCm?: number;
}

interface ReportSide {
  score: number;
  items: ReportItem[];
}

function formatSide(label: string, side: ReportSide): string {
  const lines = side.items.map((item) => {
    const parts = [`${item.label}: レベル${item.level.toFixed(1)}`];
    if (item.side) parts.push(`左右差=${item.side}`);
    if (item.type) parts.push(`種類=${item.type}`);
    if (typeof item.approxCm === 'number') parts.push(`目安逸脱量=約${item.approxCm.toFixed(1)}cm`);
    return `- ${parts.join(' / ')}`;
  });
  return `【${label}】最終偏差値: ${side.score.toFixed(1)}点\n${lines.join('\n')}`;
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'サーバーに ANTHROPIC_API_KEY を設定してください（console.anthropic.com で発行）。' },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { before?: ReportSide; after?: ReportSide };
    if (!body.before || !body.after || !Array.isArray(body.before.items) || !Array.isArray(body.after.items)) {
      return NextResponse.json({ error: 'before / after のデータが必要です' }, { status: 400 });
    }

    const userContent = `以下のBefore/Afterの計測データから、患者向けですます報告を書いてください。

${formatSide('Before（施術前）', body.before)}

${formatSide('After（施術後）', body.after)}`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    });

    const textBlock = response.content.find((block) => block.type === 'text');
    const report = textBlock && 'text' in textBlock ? textBlock.text.trim() : '';
    if (!report) {
      return NextResponse.json({ error: 'AIからの応答を取得できませんでした' }, { status: 502 });
    }

    return NextResponse.json({ report });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
