// ===== 甘ダイス ボーナス（出玉=枚数保証＋保証ゲーム数＋継続ループ） =====
// 初当たり時に振り分けで「保証枚数 × 保証G × 継続率」を決定。図柄は演出のみで、
// 出玉は本テーブルが決める（旧・確変STループの置き換え）。継続中は右打ちで大入賞口へ。
// 出玉は大入賞口に入った玉ごとに加算し、保証枚数に届くまで出す（玉が入る＝増える）。

export interface BonusType {
  /** この当たりの保証出玉(枚)。 */
  coins: number;
  /** 保証ゲーム数(回転)。枚数が大きいほど長い。 */
  games: number;
  /** ラウンド終了時の継続率（右打ち当選≒1/8 を G 回ぶん＝10G≈78% / 16G≈88%）。 */
  loop: number;
}

// 振り分け（weight）。100/10G=40, 200/10G=20, 300/10G=15, 400/16G=5（合計80を相対比で使用）。
const TABLE: { t: BonusType; w: number }[] = [
  { t: { coins: 100, games: 10, loop: 0.78 }, w: 40 },
  { t: { coins: 200, games: 10, loop: 0.78 }, w: 20 },
  { t: { coins: 300, games: 10, loop: 0.78 }, w: 15 },
  { t: { coins: 400, games: 16, loop: 0.88 }, w: 5 },
];
const TOTAL_W = TABLE.reduce((a, b) => a + b.w, 0);

/** 初当たり/継続のたびに当たり内容を抽選。 */
export function rollBonus(rng: () => number = Math.random): BonusType {
  let x = rng() * TOTAL_W;
  for (const e of TABLE) {
    x -= e.w;
    if (x < 0) return e.t;
  }
  return TABLE[0].t;
}

/** ラウンド終了時の継続抽選（保証Gに応じた継続率 loop）。true=継続(連チャン)。 */
export function rollContinue(loop: number, rng: () => number = Math.random): boolean {
  return rng() < loop;
}

/** 大入賞口1入賞あたりの賞球（残り保証枚数を超えない範囲で加算）。 */
export const ATTACKER_PRIZE = 10;

/** 表示・テスト用に振り分けを公開。 */
export const BONUS_TABLE = TABLE;
