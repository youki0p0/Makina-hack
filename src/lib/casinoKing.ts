// ===== カジノ王への挑戦〜そして伝説へ〜（100コインBETの一撃台）=====
// RTP≈1（延々打てる）だが、まれな「一撃」で約10万コイン＋大量ハイコイン。
// ハイコインは伝説賭博セットの部位指定交換にのみ使う上位通貨。

/** 1回のBET（通常コイン）。 */
export const KING_BET = 100;
/** 一撃ジャックポットの払い出し（通常コイン）。 */
export const KING_JACKPOT = 100000;
/** 一撃で得られるハイコイン。 */
export const KING_JACKPOT_HI = 2500;
/** 伝説賭博セット1部位の交換に必要なハイコイン。 */
export const LEGEND_PIECE_HI = 10000;

export type KingKind = "jackpot" | "big" | "small" | "miss";
export interface KingResult {
  /** 払い出し（通常コイン）。 */
  coins: number;
  /** 獲得ハイコイン。 */
  hi: number;
  kind: KingKind;
}

/**
 * 一撃台を1回まわす。BET=KING_BET（呼び出し側で消費）。
 * 振り分け（RTP≈0.7・少し負け越す本物の投資台。価値は一撃に集中）:
 *  一撃 1/1850 … 100,000コイン ＋ 2,500ハイコイン
 *  中   1/45   … 300〜700コイン
 *  小   1/20   … 60〜180コイン
 *  ハズレ … 0
 */
export function kingSpin(rng: () => number = Math.random): KingResult {
  const x = rng();
  const pJ = 1 / 1850;
  const pB = 1 / 45;
  const pS = 1 / 20;
  if (x < pJ) return { coins: KING_JACKPOT, hi: KING_JACKPOT_HI, kind: "jackpot" };
  if (x < pJ + pB) return { coins: 300 + Math.floor(rng() * 400), hi: 0, kind: "big" };
  if (x < pJ + pB + pS) return { coins: 60 + Math.floor(rng() * 120), hi: 0, kind: "small" };
  return { coins: 0, hi: 0, kind: "miss" };
}
