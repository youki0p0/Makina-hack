# PR運用ランブック（マージ手順 / 通る書式）

このリポジトリでの PR 作成〜マージは GitHub MCP ツールで行う。
ツール呼び出しは**必ず `antml:` 名前空間付きのタグ**で書く。素の `<invoke>` /
`<parameter>` だとハーネスが解析できず「実行されない（マージできない）」。

## 通る書式（必須）

- 開始タグ: `antml:invoke`（`name="ツール名"`）
- 引数タグ: `antml:parameter`（`name="引数名"`）
- 文字列/数値はそのまま、配列・オブジェクトは JSON。

例（CIステータス確認 → マージ）はこの順で1つずつ実行する。

### 1) CI ステータス確認
ツール: `mcp__github__pull_request_read`
- `method`: `get_check_runs`
- `owner`: `youki0p0`
- `repo`: `makina-hack`
- `pullNumber`: 対象PR番号

`build-and-test` と `Vercel Preview Comments` の両方が `conclusion: success` を確認。

### 2) ドラフト解除（ready 化）
ツール: `mcp__github__update_pull_request`
- `owner`: `youki0p0` / `repo`: `makina-hack` / `pullNumber`: 番号
- `draft`: `false`

### 3) マージ
ツール: `mcp__github__merge_pull_request`
- `owner`: `youki0p0` / `repo`: `makina-hack` / `pullNumber`: 番号
- `merge_method`: `merge`

成功時レスポンス: `{"merged": true, ...}`。`merged: true` を確認できたら完了。

## チェックリスト
1. ローカル `npm run build` / `npm run test` が緑。
2. ブランチ push 済み。PR 作成済み（draft）。
3. `get_check_runs` で CI 緑。
4. `update_pull_request` で `draft:false`。
5. `merge_pull_request` で `merged:true`。

## よくある失敗
- タグの名前空間欠落（`<invoke>`）→ 未実行。`antml:invoke` で書く。
- CI 未完了でマージ → 待ってから再確認。
- レート制限 → 少し待って再試行。
