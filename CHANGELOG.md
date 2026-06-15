# Changelog

All notable changes to Dice Ex Machina.

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
