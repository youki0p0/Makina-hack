// ===== 出玉（払い出し）ロジック（純粋関数） =====
// 当たり時、一瞬で増やさず payoutQueue を数秒かけて消化する。

import { PACHINKO_CONFIG } from "./config";
import type { ReelResult } from "./reels";

export interface PayoutPlan {
  /** 払い出す総玉数。 */
  balls: number;
  /** 消化にかける目安時間(ms)。 */
  durationMs: number;
  /** 払い出し粒子の総予算（見た目用）。 */
  particleBudget: number;
  /** Jackpot（虹色発光・最大量）。 */
  rainbow: boolean;
}

/** 当たり結果から払い出し計画を作る。 */
export function planPayout(result: ReelResult): PayoutPlan | null {
  if (!result.win || result.payout <= 0) return null;
  const rainbow = result.jackpot;
  const maxParticles = rainbow
    ? PACHINKO_CONFIG.jackpotMaxPayoutParticles
    : PACHINKO_CONFIG.maxPayoutParticles;
  // 玉数に比例しつつ上限でクランプ。
  const particleBudget = Math.min(maxParticles, Math.round(result.payout * 0.35));
  return {
    balls: result.payout,
    durationMs: result.durationMs,
    particleBudget,
    rainbow,
  };
}

/** カウンタを target へ向けて step だけ近づける（純粋）。 */
export function stepTowards(current: number, target: number, step: number): number {
  if (current >= target) return target;
  return Math.min(target, current + Math.max(1, step));
}

/**
 * 残り玉数 / 残りフレーム数から、このフレームで増やす量を決める。
 * 一定割合で消化しつつ、最低でも counterIncrementPerFrame は進める。
 */
export function counterStep(remaining: number, framesLeft: number, reduced = false): number {
  if (remaining <= 0) return 0;
  const base = reduced
    ? PACHINKO_CONFIG.counterIncrementPerFrame * 3
    : PACHINKO_CONFIG.counterIncrementPerFrame;
  if (framesLeft <= 1) return remaining;
  return Math.max(base, Math.ceil(remaining / framesLeft));
}

/** このフレームで放出する払い出し粒子数。 */
export function particlesThisFrame(remainingBudget: number, reduced = false): number {
  if (remainingBudget <= 0) return 0;
  const per = reduced
    ? Math.ceil(PACHINKO_CONFIG.payoutParticlesPerFrame / 2)
    : PACHINKO_CONFIG.payoutParticlesPerFrame;
  return Math.min(remainingBudget, per);
}
