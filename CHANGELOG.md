# Changelog

All notable changes to Dice Ex Machina.

## [Unreleased] — 絵文字のピクセルグリフ化＋高品質手続き背景

- **UIグリフ化**: 絵文字を既存アイコン体系の手続きピクセルグリフに置換（`getGlyphIconDataUrl`/
  `PixelGlyph`、26種）。プレイヤーバー/敵カード/行動ボタン/リザルト/ショップ/ガチャ/装備/
  インベントリ/タイトル/図鑑/アーティファクト等のUI記号を変換。
- **高品質な手続き背景**: `getWorldBackground` を刷新。章ごとのテーマSVGテクスチャ＋大気グラデ
  （上方アクセント光・下方ホライズン光）＋ヴィネット＋基底グラデを合成（画像アセットなし）。
- docs/icons.md 更新。test 91件グリーン／build 成功。
- 既知の残り: 戦闘ログ文中の絵文字・カジノのゲーム牌・職業/消費アイテムのデータ用アイコンは別系統のため未変換。

## [Unreleased] — 残響戦の試し場（20段ゴースト）

- `/echo` に **試し場（Trial）** を追加。20段階の練習ゴースト（`TRIAL_GHOSTS`）で強さが段階的に上昇。
- 勝利報酬はその強さより**一回り大きい**（`TRIAL_REWARD_BONUS = 1.3` 倍）。`echoRewards(entry, bonus)`。
- 「記録の残響 / 試し場」タブで切替。ランキングデータ無しでもゴースト戦をテスト可能。
- docs/online.md 更新。test 91件グリーン／build 成功。

## [Unreleased] — オンライン要素（ランキング / 残響戦）

- **ランキング `/ranking`**（深層到達者ログ）: 総合/ジョブ別/難易度別/Endless/神機マキナのフィルタ。
  記録送信は異常値を弾く（floor<1・>999999 は不可、スコアは丸め）。個人情報は送らず名前は任意(Guest)。
- **残響戦 `/echo`**（Echo Battle）: ランキング記録からゴースト敵を生成しCPU戦。報酬は素材/ゴールド/
  ランキングポイント/低確率の「残響装備」。入口はタイトル。リアルタイムPvPなし。
- **Supabase 任意接続**: 接続情報は env のみ（`NEXT_PUBLIC_SUPABASE_URL`/`..._ANON_KEY`）。
  未設定/接続失敗時は `localRankingRepository`（localStorage＋ダミー）へ自動フォールバックし落ちない。
- `@supabase/supabase-js` を追加。`Progress` に `rankPoints`/`playSeconds`、`Equipment.echo` を追加。
- `docs/online.md`・`.env.example` を追加。README/TODO 更新。test 89件グリーン／build 成功。

## [Unreleased] — ビルドの深み（ユニーク武器＋セット×職業シナジー）

- **ビルド定義ユニークを7種追加**（ドロップ可）: 狂戦の大剣／運命の片刃／死神の大鎌／疫病の香炉／
  雷霆の杖／運命のダイス／守護の盟約。ダイス表そのものを書き換える。
- **セット×職業シナジー**（`SYNERGIES`）: 盗賊×賭博師・聖騎士×吸血鬼・魔法使い×神託・
  狂戦士×処刑人・戦士×賭博師（各4部位）で追加効果。装備画面に「⚡ シナジー発動」表示。
- `computeSetEffects(equipped, classId?)` に職業引数を追加。`SetEffects.synergies` を追加。
- docs(items/set-items) 更新。test 76件グリーン／build 成功。

## [Unreleased] — 手続き生成ピクセルアイコン（画像アセット不使用）

- 装備・敵・ボスのアイコンを **16×16ドット絵のプログラム生成** に（`lib/itemIcon.ts`）。
  png/jpg/webp 等の画像アセットは持たない。Nearest-Neighbor 拡大・base64キャッシュ・SSR安全。
- `ItemIcon`（武器/防具/装飾の形状、レアリティ色、★装飾、Set紋章）と `EnemyIcon`
  （クリーチャー形状、ボス王冠、★オーラ）コンポーネントを追加。
- 神機マキナは専用ジェネレータ（歯車＋ダイス融合・黒金・虹色）。
- インベントリ/装備/詳細/ドロップ/ガチャ結果/戦闘の敵/図鑑に組み込み。
- `docs/icons.md` を追加。test 73件グリーン／build 成功。

## [Unreleased] — アイテム/装備/セットの無限化

- **装備ステの無限スケール**: 基底ティア上限(60)を撤廃。`genTierForFloor=floor` で深さに応じ
  無限にスケール（★も併用）。深層素材名も `materialFor` で破綻せず生成。
- **セットの効果プリミティブ化**: 名前付き4セットを `SetTierBonus` の合成で表現（`computeSetEffects`）。
- **無限セット**: `proceduralSetDef(n)`（key `gset<n>`）が深層で新セット原型を無限生成。
  `availableSetKeys(floor)`／`proceduralSetFloor`（150階ごと）で解禁。
- **セット装備のティア化**: `genSetItem(key, slot, tier)`／id `setp_<key>_<slot>_<tier>` で無限スケール。
  静的セット装備リストを廃止し、ドロップ専用に（`rollSetDrop`）。
- `Equipment.setId` を string 化（手続きセットキー対応）。UIは `getSetDef` で解決。
- 図鑑「セット」タブは名前付きセットを表示し、深層は手続き生成である旨を明記。
- test 71件グリーン／build 成功。

## [Unreleased] — 手続き生成への移行（エンティティ非増殖）

6スロット化で「スロット×ティア」を静的に持つと装備数が倍々に増える問題を解消。

### Changed
- 通常ステ装備を **手続き生成**（`genItem(slot, tier)` / id `gen_<slot>_<tier>`）に移行。
  `getItemById` がIDから再構築するため、静的な生成装備リスト（旧366件）を廃止。
- `ITEMS` は **キュレーション装備（署名＋セット）のみ** の有限リストに。スロット数・階層が
  増えても登録数は一定、floor 1000+ もティアを保存せず表現可能。
- ドロップ/ガチャ/ショップを手続き生成に対応（限定・署名・セットはキュレーション側から混合）。
- **スマートドロップ**: 手続きドロップを空き/弱いスロットへ寄せ、6スロットでも収集が
  2倍にならないように（`gameStore` の `weakestSlot`）。
- 図鑑の装備収集率は **署名＋セットのみ** を対象（素材装備は対象外）。

### Tests
- `loot.test` を手続き生成前提に更新。全 69 件グリーン。`npm run build` 成功。


## [Unreleased] — Major world progression & balance + Dice Ex Machina overhaul

`feature/world-progression-major-update` ブランチ。デバッグ段階のため **saveVersion を 3 に更新し
旧セーブは破棄**（localStorage 互換なし）。

### Added — ワールド進行と大型アップデート（第1段）
- ワールド進行: 100階ごとに10章＋1000階クリアで Endless Abyss（`data/worlds.ts`）。
- ワールド背景: 章ごとの CSS グラデを戦闘/ショップに適用。
- ワールドクリア画面: 章ボス撃破で静かな Complete 演出。
- 死亡ペナルティ緩和: 到達階×100G、全財産没収禁止（最大90%）、0未満禁止。
- 難易度報酬差: Normal/Hard/Hell に **Expert** を追加。ドロップ数・上振れ・高レア率を難易度連動。
- ガチャ最低保証: 10=コモン量産 / 100=高補正コモン / 250=部位指定レア以上保証。
- ★モディファイア無限化（加算 +20%/★）を装備・敵に付与（`data/modifiers.ts`）。
- ジョブ調整を `data/jobBalance.ts` に集約（攻撃倍率）。
- レジェンド一括売却、ロック機能（分解/売却保護）。
- レアリティ視認性（✦ピップ＋Legendary虹色グロー）、装備比較、図鑑収集率。
- 転生ポイントを最高到達階の100階区切り初到達のみに変更（死亡/周回では増えない）。
- 転職は倒れた後のみ＋敗北画面に「転職」「ホームに戻る」導線。

### Added — Dice Ex Machina 化（第2段）
- **装備6スロット化**（武器/兜/鎧/篭手/靴/装飾）。`EQUIP_SLOTS` を6部位に拡張。
- **セット装備**（賭博師/吸血鬼/処刑人/神託）。2/4/6部位でビルドが変わる（`data/sets.ts`）。
- **品質 Ancient / Mythic / Unique**（`data/quality.ts`）。Legendary から確率昇格。
- **ボス階層再編**: 10階=小ボス / 50階=大ボス / 100階=章ボス。
- ガチャの★は **最高到達階で上限**（未来装備を引けない）。
- **1000階エンディング**（DEUS EX MACHINA 撃破→スタッフロール、飛ばせない・一度きり）。
- **強くてニューゲーム（YES）** と **Endless Abyss（NO）** の分岐、Endless 物語（1050〜1250）。
- **神機マキナ**（唯一武器・全出目を通常攻撃化・売却/分解/Modifier不可）。
- 図鑑に「セット」タブ、装備画面に発動中セット効果を表示。
- ドキュメント整備: `README.md` / `docs/worlds.md` / `docs/items.md` / `docs/set-items.md` /
  `docs/lore.md` / `CHANGELOG.md`。

### Changed
- セーブ: `saveVersion=3`、キー `dice-hackslash-save-v3`、装備に品質を永続化。
- ショップ階の除外をボス周期（10階）に合わせて調整。

### Tests
- Vitest: `progression` / `sets` テストを追加。全 67 件グリーン。`npm run build` 成功。
