// ===== カジノ王への挑戦〜そして伝説へ〜（100コインBETのスロット＋挑戦演出）=====
// 仕様（#125〜）:
//  ・BET100のスロット。小当たり 1/200（天井: 小当たりなしで200回転に達したら小当たり確定）。
//  ・小当たり時に 1500コイン獲得＋「カジノ王への挑戦」へ。
//  ・挑戦は勝率1/10。勝てば一撃＝+75,000コイン＋2,500ハイコイン（独立台＝通常スロットのATとは非連動）。
//  ・天井で小当たり頻度が上がるため実質 一撃≈1/1280・RTP≈0.70。

/** 1回のBET（通常コイン）。 */
export const KING_BET = 100;
/** 一撃（挑戦勝利）の上乗せコイン。 */
export const KING_JACKPOT = 75000;
/** 一撃で得られるハイコイン。 */
export const KING_JACKPOT_HI = 2500;
/** 小当たりの払い出し（挑戦の勝敗に関わらず必ず得る）。天井で頻度が上がるため控えめ。 */
export const KING_SMALL_PAY = 1500;
/** 小当たり確率。 */
export const KING_SMALL_PROB = 1 / 200;
/** 挑戦の勝率（勝てば一撃）。 */
export const KING_CHALLENGE_WIN = 1 / 10;
/** 天井: 小当たりなしでこの回転数に達したら小当たり確定。 */
export const KING_SMALL_CEILING = 200;
/** 伝説賭博セット1部位の交換に必要なハイコイン。 */
export const LEGEND_PIECE_HI = 10000;
/** 一度きりの補填額（過去にカジノ王を回した痕跡がある人へ）。 */
export const KING_COMP_COINS = 300000;

export type KingOutcome = "miss" | "smallLose" | "jackpot";
export interface KingResult {
  /** miss=ハズレ / smallLose=小当たり(挑戦敗北) / jackpot=小当たり→挑戦勝利=一撃。 */
  outcome: KingOutcome;
  /** この回の払い出し（通常コイン）。 */
  coins: number;
  /** 獲得ハイコイン。 */
  hi: number;
  /** 「カジノ王への挑戦」カットインを出すか（=小当たりが成立したか）。 */
  challenge: boolean;
}

/**
 * 天井つきで1回まわす。`pity` は小当たりなしで回した回転数。
 * 小当たり成立（天井 or 1/200）→挑戦（勝率1/10）→勝てば一撃。
 * 小当たりが出たら pity を 0 にリセット、ハズレは +1。
 */
export function kingSpinWithPity(
  pity: number,
  rng: () => number = Math.random,
): { result: KingResult; nextPity: number } {
  // 小当たり判定（天井到達 or 確率）。
  const small = pity + 1 >= KING_SMALL_CEILING || rng() < KING_SMALL_PROB;
  if (!small) {
    return { result: { outcome: "miss", coins: 0, hi: 0, challenge: false }, nextPity: pity + 1 };
  }
  // 小当たり成立 → 「カジノ王への挑戦」。勝てば一撃。
  if (rng() < KING_CHALLENGE_WIN) {
    return {
      result: { outcome: "jackpot", coins: KING_SMALL_PAY + KING_JACKPOT, hi: KING_JACKPOT_HI, challenge: true },
      nextPity: 0,
    };
  }
  return { result: { outcome: "smallLose", coins: KING_SMALL_PAY, hi: 0, challenge: true }, nextPity: 0 };
}
