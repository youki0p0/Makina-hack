// ===== Title (称号) award reducer =====
// Pure, store-free functions: given Progress, decide which titles are newly
// unlocked and how many 転生ポイント(souls) to grant. One-time per title via the
// progress.claimedTitles ledger, so it is idempotent and safe to call anywhere
// (after battle, on casino/forge actions, and once retroactively on hydrate).

import { TITLES, titleSouls } from "@/data/titles";
import type { Progress } from "@/types/game";

/** Split a possibly-fractional soul total into spendable whole + carried fraction. */
export function splitSouls(total: number): { whole: number; frac: number } {
  const rounded = Math.round(total * 100) / 100; // kill float noise
  const whole = Math.floor(rounded + 1e-9);
  const frac = Math.round((rounded - whole) * 100) / 100;
  return { whole, frac };
}

export interface TitleGrant {
  /** Updated progress (claimedTitles extended, soulsFraction updated). */
  progress: Progress;
  /** Whole souls to ADD to the player's integer soul count. */
  soulsGained: number;
  /** Newly unlocked title ids (for toasts/logs). */
  unlocked: string[];
}

/**
 * Reconcile titles against current progress. Grants souls (0.5/0.75/1.0 per tier)
 * for any satisfied title not yet in claimedTitles. Fractions accumulate in
 * progress.soulsFraction and only whole souls are emitted. Pure — returns deltas.
 */
export function grantTitles(progress: Progress, souls: number): { progress: Progress; souls: number; unlocked: string[] } {
  const claimed = new Set(progress.claimedTitles);
  const unlocked: string[] = [];
  let gained = 0;
  for (const t of TITLES) {
    if (!t.id || !t.check || !t.tier) continue; // skip the "(なし)" sentinel
    if (claimed.has(t.id)) continue; // already rewarded — idempotent
    if (t.check(progress)) {
      unlocked.push(t.id);
      gained += titleSouls(t);
    }
  }
  if (unlocked.length === 0) return { progress, souls, unlocked };

  const { whole, frac } = splitSouls(progress.soulsFraction + gained);
  return {
    progress: {
      ...progress,
      claimedTitles: [...progress.claimedTitles, ...unlocked],
      soulsFraction: frac,
    },
    souls: souls + whole,
    unlocked,
  };
}
