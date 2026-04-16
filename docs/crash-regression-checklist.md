# クラッシュ耐性テストチェックリスト

- [ ] `npm run dev` で起動する
- [ ] `http://localhost:3000` を開く
- [ ] DevTools の Console を開いておく（エラー監視）

## 1. 旧データ投入（Supabase SQL Editor）

- [ ] ケースAを実行

```sql
insert into patient (name, base_info, chart_data, last_visit, tags)
values (
  '旧データA',
  '{"gender":"女性"}'::jsonb,
  '{
    "latest": {
      "date": "2026-01-10",
      "visitNumber": 3,
      "numericInspections": {"顔": 4.0}
    },
    "history": []
  }'::jsonb,
  '2026-01-10',
  null
);
```

- [ ] ケースBを実行

```sql
insert into patient (name, base_info, chart_data, last_visit, tags)
values (
  '旧データB',
  '{"age":"42","phone":"090-0000-0000"}'::jsonb,
  '{
    "latest": {
      "date": "2026-02-01",
      "visitNumber": 1,
      "numericInspections": {"肩上": 2.5, "軸": 3.0},
      "metaInspections": {
        "kneeFlexion": {"side":"右","cm":12},
        "kneeInternalRotation": {"side":"左","cm":8},
        "neck": {"side":"右","pos":"上"},
        "waist": {"side":"左","pos":"下"}
      },
      "images": {}
    }
  }'::jsonb,
  '2026-02-01',
  '["既存"]'::jsonb
);
```

- [ ] ケースCを実行

```sql
insert into patient (name, base_info, chart_data, last_visit, tags)
values (
  '旧データC',
  '{}'::jsonb,
  '{}'::jsonb,
  null,
  '[]'::jsonb
);
```

## 2. 各データで同一手順（A/B/Cそれぞれ）

- [ ] 一覧表示でカードが出る（白画面にならない）
- [ ] カードクリックで編集画面に入れる
- [ ] ヘッダーの `氏名` を編集
- [ ] ヘッダーの `受診回数` を編集
- [ ] タグを1つ追加
- [ ] タグを1つ削除
- [ ] 顔スライダーを動かす
- [ ] 肩上/軸/ASいずれかの左右切替
- [ ] 膝屈曲の左右とcmを変更
- [ ] 膝屈曲内旋の左右とcmを変更
- [ ] 首の左右/位置を変更
- [ ] 腰の左右/位置を変更
- [ ] 肩捻じれの左右を変更
- [ ] 人体図に赤線を描く
- [ ] 人体図の「消去」を押す
- [ ] Before/After の画像枠を1か所以上アップロード
- [ ] `4ペアを一括生成` を押す（未設定箇所があってもOK）
- [ ] `保存` を押す
- [ ] 一覧に戻る
- [ ] 同じ患者を再度開く

## 3. 合格条件

- [ ] `This page couldn’t load` が一度も出ない
- [ ] Console に `Cannot read properties of undefined` が出ない
- [ ] 保存後・再読込後も編集できる
- [ ] 比較画像生成ボタン押下時に落ちない（空データ含む）

## 4. 追加の安心確認（任意）

- [ ] A/B/Cそれぞれ、開く→保存→再度開くを2サイクル実施
- [ ] 一覧のタグ検索（文字列）とタグ絞り込みが動作する
