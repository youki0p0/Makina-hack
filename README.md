# 🎲 Dice Ex Machina

**ダイス版 Diablo。** 装備で **ダイスの出目そのものが書き換わる**、スマホ縦画面向けの
コマンド式ハクスラRPG。戦闘の操作は「リロール」と「決定」の2つだけ。

> **Vision** — Dice Ex Machina は放置ゲームではない。プレイヤー自身はほとんど成長しない。
> 強くなるのは **装備・ビルド・プレイヤーの知識**。1000階に明確な終わりがあり、その先は
> プレイヤー自身の物語（Endless Abyss）になる。

Next.js (App Router) + TypeScript + Tailwind CSS + Zustand + localStorage。Vercel にそのまま
デプロイできます。

---

## ゲームループ

敵を倒す → 装備を拾う → ダイス面が変わる → ビルドが変わる → 深く潜る → 新しい世界を見る → さらに潜る

---

## 遊び方

1. タイトルで難易度・出発階を選び **はじめる**。
2. ターンごとに6面ダイスが振られる。操作は **🎲 リロール** と **⚔️ 決定** のみ。
3. 敵HPを0にすれば勝利、自分のHPが0なら敗北。
4. 勝つと EXP・ゴールド・**装備**を獲得して次の階へ。
5. 敗北すると **到達階×100G** を失い（全財産没収はされない）、セーブポイントの直後から再開。
6. **10階ごとに小ボス / 50階で大ボス / 100階で章ボス。** 100階ごとに世界が変わる。
7. **1000階の DEUS EX MACHINA** を倒すと物語が終わる。その先は **Endless Abyss**。

### 初期ダイス表

| 出目 | 効果 |
| --- | --- |
| 1 | ミス |
| 2 | 小攻撃 |
| 3 | 通常攻撃 |
| 4 | 強攻撃 |
| 5 | クリティカル |
| 6 | スキル攻撃 |

装備・職業・**セット効果**が各出目の意味を書き換えます。変化した出目には `✦` 印が付きます。

---

## 主要システム（詳細は docs/ を参照）

- **ワールド進行** — 100階ごとに10章＋Endless Abyss。背景はCSSグラデのみ。→ [docs/worlds.md](docs/worlds.md)
- **★モディファイア** — 50階ごとに装備・敵へ★が付き、**加算で**無限に強化（完成装備なし）。→ [docs/worlds.md](docs/worlds.md)
- **装備とレアリティ・品質** — 6スロット、Common〜Legendary＋Ancient/Mythic/Unique。通常装備は
  **手続き生成**（IDから再構築）でエンティティを増殖させない。→ [docs/items.md](docs/items.md)
- **セット装備** — 賭博師 / 吸血鬼 / 処刑人 / 神託。2・4・6部位でビルドが変わる。→ [docs/set-items.md](docs/set-items.md)
- **ガチャ** — 10=コモン量産 / 100=高補正コモン(レア以上なし) / 250=部位指定レア以上保証。★は最高到達階で上限。
- **難易度** — 高難度ほどドロップ数・上振れ・レア率UP（Normal/Hard/Hell/Expert）。
- **職業** — 聖騎士(耐久)/戦士(火力)/盗賊(連撃)/魔法使い(爆発)/狂戦士(超火力)。倍率は `data/jobBalance.ts`。
- **転生ポイント** — 最高到達階の100階区切り初到達でのみ獲得（死亡・周回では増えない）。
- **エンディングと物語** — 1000階撃破→スタッフロール→強くてニューゲーム or Endless。→ [docs/lore.md](docs/lore.md)
- **神機マキナ** — 世界に一本だけの唯一武器。全出目を通常攻撃にする。→ [docs/lore.md](docs/lore.md)
- **図鑑 / 装備比較 / ロック / レジェンド一括売却** — 収集率表示、装備中との差分、ロック保護。
- **手続き生成ピクセルアイコン** — 装備・敵・ボスのアイコンを画像なしでコード生成。→ [docs/icons.md](docs/icons.md)
- **ランキング / 残響戦** — 深層到達者ログと、記録から生成したゴーストとのEcho Battle（Supabase任意・未設定でも動作）。→ [docs/online.md](docs/online.md)

---

## 開発手順

```bash
npm install      # 依存関係をインストール
npm run dev      # http://localhost:3000 で開発サーバー起動
npm run build    # 本番ビルド（型チェック込み）
npm run start    # ビルド済みアプリを起動
npm run test     # ユニットテスト（Vitest）
```

スマホ縦画面想定。ブラウザのデバイスツールバーで縦長表示にすると確認しやすいです。
Vercel はこのリポジトリをそのままインポートするだけでデプロイできます。

---

## ディレクトリ構成

```
src/
  app/            タイトル/戦闘/インベントリ/図鑑/アーティファクト/カジノ 各画面
  components/     BattleScreen(戦闘+各種オーバーレイ) / InventoryList / EquipmentPanel / GachaPanel ...
  data/
    items.ts      装備（署名/セット=キュレーション＋手続き生成 genItem/神機マキナ）
    sets.ts       セット定義と効果計算 computeSetEffects
    quality.ts    Ancient/Mythic/Unique 品質
    modifiers.ts  ★モディファイア（加算・無限）
    worlds.ts     ワールド10章＋Endless、背景グラデ
    milestones.ts 転生ポイント／階層実績
    jobBalance.ts 職業バランス（攻撃倍率）
    lore.ts       エンディング/Endless/神機マキナの文言
    enemies.ts    敵テンプレ＋ボス階層（10/50/100）
    difficulty.ts 難易度（ドロップ数/レア率/上振れ）
  lib/
    dice.ts       applyEquipmentModifiers（出目書き換えの中核）
    battle.ts     ダメージ計算・EQUIP_SLOTS(6スロット)
    loot.ts       ドロップ/ガチャ抽選
    save.ts       localStorage 保存（saveVersion=3）
    ui.ts         レアリティ表示・✦ピップ
  store/gameStore.ts   Zustand ストア（全状態・全アクション）
  types/game.ts        型定義
docs/             worlds / items / set-items / lore のドキュメント
```

---

## 状態管理と保存

Zustand で全状態を管理し、localStorage に保存します（キー `dice-hackslash-save-v3`、
`saveVersion = 3`）。**デバッグ段階のため旧バージョンのセーブは読み込み時に破棄**されます。

装備は **ID・接尾辞・★・品質のみ**を保存し、読み込み時に `data/items.ts` から復元するため、
出目変化のロジック（関数的データ）も安全にシリアライズできます。

---

## Claude Code Skill

`.claude/skills/mobile-dice-hackslash/SKILL.md`（Skill 名 `mobile-dice-hackslash`）に
開発指針を同梱。`/mobile-dice-hackslash` で呼び出せます。スマホ縦UI・2ボタン戦闘・
**装備でダイス面を書き換える**コアを壊さないこと、1 Issue = 1 PR、`npm run build` /
`npm run test` が通るまで直すことを徹底します。

`.claude/skills/fusion/` にはマルチモデル・パネルの **Fusion** スキルも同梱しています
（`/fusion` ほか。外部CLI/送信に関する注意は Skill 内記載。出典:
https://github.com/duolahypercho/fusion-fable 、MIT License）。
