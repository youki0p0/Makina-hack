---
name: mobile-dice-hackslash
description: >-
  Guidance for developing this mobile-first, command-style dice hack-and-slash
  RPG (Next.js App Router + TypeScript + Tailwind + Zustand + localStorage,
  deployed on Vercel). Use whenever adding features, fixing bugs, or changing
  UI/balance in this repo. Enforces the core design (equipment rewrites dice
  faces), the 2-button battle UX (Reroll / Confirm), portrait-first mobile UI,
  and the 1-issue=1-PR workflow.
---

# mobile-dice-hackslash

このリポジトリ（ダイスダンジョン）の開発を効率化するための作業指針。
スマホ向けNext.js/Vercelゲームを「既存仕様を壊さず、小さく」育てるためのルール。

## 前提技術スタック

- **Next.js App Router**（`src/app/`、すべてクライアント描画は `"use client"`）
- **TypeScript**（`any` を避け、型安全に。共通型は `src/types/game.ts`）
- **Tailwind CSS**（`src/app/globals.css` の `.app-shell` でスマホ幅に固定）
- **Zustand**（全状態は `src/store/gameStore.ts` の単一ストア）
- **localStorage**（保存/復元は `src/lib/save.ts`）
- デプロイは **Vercel**（デフォルト設定でビルド可能に保つ）

## 絶対に守る設計（コアコンセプト）

1. **装備がダイスの出目効果を書き換える** のがこのゲームの肝。
   - 基本ダイス表は `src/data/diceFaces.ts` の `baseDiceFaces`。
   - 装備は `src/data/items.ts` に `diceModifiers`（宣言的データ）で定義する。
   - 最終的な出目は `src/lib/dice.ts` の `applyEquipmentModifiers()` で合成する。
   - **新しい出目効果は、まずこの仕組みの上で表現できないか検討する。**
     新フィールドが必要なら `DiceFaceEffect` を拡張し、`mergeEffect` に追加する。
2. **戦闘中の操作は「リロール」「決定」の2つだけ**（`ActionButtons.tsx`）。
   ボタンを増やさない。迷わせない。テンポ重視。
3. **スマホ縦画面UIを最優先**。画面下部に大きなタップ領域、短いテキスト、
   片手操作。新UIも `.app-shell`（最大幅 28rem）の縦並び前提で作る。
4. **装備で変化した出目は一目で分かるように**（`✦` 表示、`modifiedBy` を活用）。

## 状態とデータの扱い

- 状態追加は `gameStore.ts` に集約。コンポーネントにロジックを散らさない。
- 純粋計算（ダメージ・レベル・ステータス集計）は `src/lib/battle.ts`、
  ドロップ抽選は `src/lib/loot.ts`。UIから直接乱数や計算を書かない。
- **localStorage には装備IDのみ保存**し、`getItemById()` で復元する
  （関数的データを安全にシリアライズするため）。新規保存項目も同方針。
- セーブ構造（`SaveData`）を変える時は後方互換に注意（壊れたら `loadGame` が
  `null` を返し新規ゲームになる）。将来的にはバージョニングを検討。

## 敵・バランス

- 敵テンプレートと階層スケーリングは `src/data/enemies.ts`。
- **5階ごとにボス**（`floor % 5 === 0`）の仕様を維持する。
- バランス変更は数値のみ最小限に。ゲームループの形は変えない。

## 実装ワークフロー（厳守）

- **1 Issue = 1 PR**。1つのPRで1つの目的だけを扱う。
- **`main` へ直接 push しない**。必ず作業ブランチ → PR。
- 変更は**小さく**。大規模リファクタはせず、既存仕様を壊さない。
- 実装後、**`npm run build` が通るまで修正する**（型エラー0が完了条件）。
  - `npm run dev` で起動確認、`npm run build` で型チェック込みビルド確認。
- PR は作成後 **CI 通過で自動マージ前提**。CIを壊したら直す。
- 完成条件チェック: 戦闘できる / リロール・決定が効く / 敵を倒せる /
  装備がドロップ・変更でき、**ダイス面が変わる** / localStorage 保存が効く。
- **リリースノートを追記する**: ユーザー向けに意味のある変更を加えたら、同じ PR 内で
  `src/app/news/page.tsx` の `NOTES` 配列**先頭**に新エントリを**おちゃめな文体**で足す
  （既存エントリのトーンに合わせる）。内部リファクタやビルド版数更新など、プレイヤーに
  無関係な変更は不要。詳細はリポジトリ直下の `CLAUDE.md` を参照。

## よくある作業の入口（ファイル早見表）

| やりたいこと | 触るファイル |
| --- | --- |
| 新しい装備を追加 | `src/data/items.ts`（`diceModifiers` で出目変化を定義） |
| 新しい出目効果の種類 | `src/types/game.ts`(`DiceFaceEffect`/`DiceKind`) → `src/lib/dice.ts`(`mergeEffect`) → `src/lib/battle.ts`(`resolvePlayerAction`) → `src/lib/ui.ts`(色) → `src/data/diceFaces.ts`(アイコン) |
| 新しい敵 / ボス調整 | `src/data/enemies.ts` |
| 戦闘ロジック・計算 | `src/lib/battle.ts` |
| ドロップ率・テーブル | `src/lib/loot.ts` |
| 状態・フロー | `src/store/gameStore.ts` |
| 戦闘画面UI | `src/components/BattleScreen.tsx` ほか `components/` |
| 保存項目 | `src/lib/save.ts` + `src/types/game.ts`(`SaveData`) |

## チェックリスト（PRを出す前に）

- [ ] `npm run build` が成功する（型エラーなし）
- [ ] 戦闘操作は「リロール」「決定」のみのまま
- [ ] 装備による出目書き換えの仕組みを壊していない
- [ ] スマホ縦画面で破綻しない（最大幅 28rem 想定）
- [ ] localStorage の保存/復元が動く
- [ ] 既存の挙動を壊していない（小さな差分になっている）
