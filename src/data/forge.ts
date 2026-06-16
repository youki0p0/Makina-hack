// ===== Blacksmith / Forge (鍛冶屋) =====
// Spends material (gachaPoints) to FORGE equipment: a probabilistic, decisive
// power path that gives the player the multiplicative growth enemies have via ★.
// It only touches numbers (attack/defense/maxHp) + name — NEVER diceModifiers —
// so the core "equipment rewrites the dice" concept is preserved.
//
// No-rage design: forge level NEVER goes down. High levels can "fail" (level
// stays, material partly refunded). GREAT/PERFECT over-rolls (+2/+3) are the
// excitement; a pity streak raises the odds so it always eventually lands.

import type { Equipment } from "@/types/game";

export const FORGE_MAX = 15;
/** Additive bonus per forge level (+7% per level). */
export const FORGE_BONUS_PER_LV = 0.07;

/** Material cost to attempt the next forge level (level → level+1). */
export function forgeCost(level: number): number {
  return 8 + level * level * 2; // 8,10,16,26,40,58,80,…,400
}

/** Material cost to inject one ★ modifier tier. */
export function starInjectCost(modTier: number): number {
  return 250 * (Math.max(0, modTier) + 1);
}

export type ForgeKind = "normal" | "great" | "perfect" | "fail";

export interface ForgeOutcome {
  /** Levels gained (0 on fail). */
  delta: number;
  kind: ForgeKind;
  /** Material refunded (only on fail). */
  refund: number;
}

/**
 * Roll a forge attempt. `streak` = consecutive fails so far (pity).
 * `protect` guarantees no fail (costs more material; handled by caller).
 */
export function rollForge(level: number, streak: number, protect: boolean): ForgeOutcome {
  const cost = forgeCost(level);
  // Failure only matters from level 4 up; pity and protection reduce it.
  let failChance = level < 4 ? 0 : Math.min(0.6, (level - 3) * 0.07);
  failChance = Math.max(0, failChance - streak * 0.05);
  if (protect) failChance = 0;

  if (Math.random() < failChance) {
    return { delta: 0, kind: "fail", refund: Math.round(cost * 0.4) };
  }
  // Success — chance to over-roll. Pity also nudges GREAT odds.
  const r = Math.random();
  const perfect = 0.08;
  const great = 0.25 + streak * 0.03;
  if (r < perfect) return { delta: 3, kind: "perfect", refund: 0 };
  if (r < perfect + great) return { delta: 2, kind: "great", refund: 0 };
  return { delta: 1, kind: "normal", refund: 0 };
}

/** Success probability for the UI (0..1). Mirrors rollForge's fail logic. */
export function forgeSuccessChance(level: number, streak: number, protect: boolean): number {
  if (protect) return 1;
  let failChance = level < 4 ? 0 : Math.min(0.6, (level - 3) * 0.07);
  failChance = Math.max(0, failChance - streak * 0.05);
  return 1 - failChance;
}

/** Apply the forge level's additive multiplier to an item's numbers + name. */
export function applyForge(item: Equipment, level: number): Equipment {
  if (!level || level <= 0 || item.noModifier) return level > 0 ? { ...item, forgeLevel: level } : item;
  const m = 1 + FORGE_BONUS_PER_LV * level;
  const s = (n: number) => (n ? Math.round(n * m) : n);
  return {
    ...item,
    attack: s(item.attack),
    defense: s(item.defense),
    maxHp: s(item.maxHp),
    forgeLevel: level,
    name: `${item.name}+${level}`,
  };
}
