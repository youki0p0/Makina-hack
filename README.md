# 🎲 ダイスダンジョン

装備で**ダイスの出目効果が書き換わる**、スマホ向けのコマンド式ハクスラRPG。
戦闘中の操作は「リロール」と「決定」だけ。テンポよく1周遊べる軽量設計です。

Next.js (App Router) + TypeScript + Tailwind CSS + Zustand + localStorage で実装、
Vercel にそのままデプロイできます。

---

## 遊び方

1. タイトルで **はじめる** を押すと戦闘が始まります。
2. ターンごとに6面ダイスが自動で振られます。
3. 出目を見て選ぶのは2つだけ：
   - **🎲 リロール** … もう一度振り直す（回数は装備で増減）
   - **⚔️ 決定** … 今の出目の効果を発動する
4. 行動後に敵が反撃。敵のHPを0にすれば勝利、自分のHPが0になれば敗北。
5. 勝つと EXP・ゴールド・**装備**を獲得し、次の階へ。
6. 負けるとダンジョンは1階に戻り、ゴールドを一部失います。
7. **5階ごとにボス**が出現します。

### 初期ダイス表

| 出目 | 効果 |
| --- | --- |
| 1 | ミス |
| 2 | 小攻撃 |
| 3 | 通常攻撃 |
| 4 | 強攻撃 |
| 5 | クリティカル |
| 6 | スキル攻撃 |

### 装備で出目が変わる（コアの面白さ）

装備を変えると、各出目の意味そのものが書き換わります。例：

- **鉄の剣** … `1` のミスを小攻撃に変更
- **盗賊の短剣** … `5以上`で2回攻撃／リロール+1
- **吸血の剣** … `4以上`で与ダメージの25%を回復
- **呪いの斧** … `1〜2`で自傷、`5〜6`で大ダメージ
- **重装鎧** … `1〜3`でガード、リロール-1
- **賭博師の指輪** … `1`で自傷、`6`で超火力
- **魔導書** … `6`を火球スキルに変更

戦闘画面では、変化した出目に `✦` 印が付き、現在の出目の効果が大きく表示されます。
装備画面で装備を入れ替えると、ダイス表がその場で書き換わります。

---

## 開発手順

```bash
npm install      # 依存関係をインストール
npm run dev      # http://localhost:3000 で開発サーバー起動
npm run build    # 本番ビルド（型チェック込み）
npm run start    # ビルド済みアプリを起動
```

スマホ縦画面想定のため、ブラウザのデバイスツールバーで縦長表示にすると確認しやすいです。

### Vercel へのデプロイ

このリポジトリをそのまま Vercel にインポートするだけでデプロイできます。
ビルドコマンド・出力ディレクトリは Next.js のデフォルト設定でOKです。

---

## ディレクトリ構成

```
src/
  app/
    page.tsx              タイトル画面
    battle/page.tsx       戦闘画面
    inventory/page.tsx    インベントリ画面
    layout.tsx            共通レイアウト（スマホ幅に固定）
    globals.css
  components/
    BattleScreen.tsx      戦闘画面の構成 + リザルトオーバーレイ
    DiceDisplay.tsx       現在の出目と全6面の表示
    ActionButtons.tsx     リロール / 決定
    EnemyCard.tsx         敵カード
    PlayerStatus.tsx      プレイヤーのHP/攻防/EXP
    InventoryList.tsx     所持品 + 装備詳細モーダル
    EquipmentPanel.tsx    装備中スロット
    BattleLog.tsx         戦闘ログ
  data/
    items.ts              全装備データ（出目変化の定義）
    enemies.ts            敵テンプレートと階層スケーリング
    diceFaces.ts          基本ダイス表
  lib/
    dice.ts               applyEquipmentModifiers（出目書き換えの中核）
    battle.ts             ダメージ計算・レベルアップ・ステータス集計
    loot.ts               ドロップ抽選
    save.ts               localStorage 保存/読み込み
    ui.ts                 レアリティ等の表示用ヘルパー
  store/
    gameStore.ts          Zustand ストア（全状態の管理）
  types/
    game.ts               型定義
```

---

## 状態管理と保存

Zustand で `player` / `equipped` / `inventory` / `currentEnemy` / `currentFloor` /
`battleState` / `diceValue` / `diceFaces` / `rerollsLeft` / `battleLog` を管理します。

localStorage には `player` / 装備ID / 所持品ID / `currentFloor` を保存します。
装備は **ID のみ**を保存し、読み込み時に `data/items.ts` から復元するため、
出目変化のロジック（関数的データ）も安全にシリアライズできます。
