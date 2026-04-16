# クラッシュ耐性テスト結果テンプレート

## 実施情報

- 実施日:
- 実施者:
- 対象ブランチ:
- 確認対象ファイル: `app/page.tsx`
- 備考:

## 環境

- OS:
- Node.js:
- パッケージマネージャ:
- ブラウザ:
- Supabase プロジェクト:

## 旧データ投入結果

| ケース | レコード作成 | 備考 |
|---|---|---|
| A | OK / NG |  |
| B | OK / NG |  |
| C | OK / NG |  |

## 実施チェック結果（A/B/C 共通）

| No | チェック項目 | A | B | C | メモ |
|---|---|---|---|---|---|
| 1 | 一覧表示でカードが出る（白画面なし） | OK / NG | OK / NG | OK / NG |  |
| 2 | カードクリックで編集画面に入れる | OK / NG | OK / NG | OK / NG |  |
| 3 | ヘッダーの氏名を編集できる | OK / NG | OK / NG | OK / NG |  |
| 4 | ヘッダーの受診回数を編集できる | OK / NG | OK / NG | OK / NG |  |
| 5 | タグ追加/削除ができる | OK / NG | OK / NG | OK / NG |  |
| 6 | 顔スライダーを操作できる | OK / NG | OK / NG | OK / NG |  |
| 7 | 肩上/軸/AS の左右を切替できる | OK / NG | OK / NG | OK / NG |  |
| 8 | 膝屈曲の左右/ cm を変更できる | OK / NG | OK / NG | OK / NG |  |
| 9 | 膝屈曲内旋の左右/ cm を変更できる | OK / NG | OK / NG | OK / NG |  |
| 10 | 首の左右/位置を変更できる | OK / NG | OK / NG | OK / NG |  |
| 11 | 腰の左右/位置を変更できる | OK / NG | OK / NG | OK / NG |  |
| 12 | 肩捻じれの左右を変更できる | OK / NG | OK / NG | OK / NG |  |
| 13 | 人体図の描画/消去ができる | OK / NG | OK / NG | OK / NG |  |
| 14 | Before/After 画像を1枚以上アップロードできる | OK / NG | OK / NG | OK / NG |  |
| 15 | 4ペア一括生成を押しても落ちない | OK / NG | OK / NG | OK / NG |  |
| 16 | 保存して一覧に戻れる | OK / NG | OK / NG | OK / NG |  |
| 17 | 再度開いて編集を継続できる | OK / NG | OK / NG | OK / NG |  |

## 重要エラー確認

| 項目 | 結果 | メモ |
|---|---|---|
| `This page couldn’t load` が未発生 | OK / NG |  |
| `Cannot read properties of undefined` が未発生 | OK / NG |  |

## 追加確認（任意）

- A/B/C それぞれ「開く→保存→再度開く」を2サイクル実施:
  - A: OK / NG
  - B: OK / NG
  - C: OK / NG
- 一覧のタグ検索（文字列）:
  - OK / NG
- 一覧のタグ絞り込み:
  - OK / NG

## 総合判定

- 判定: PASS / FAIL
- 理由:

## NG時の詳細ログ

- 再現手順:
- 発生ケース: A / B / C
- 画面:
- エラーメッセージ:
- Consoleログ:
- スクリーンショット:
