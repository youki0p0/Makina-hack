// ===== Infinite equipment & enemy modifiers (★) =====
// Every 50 floors items and enemies gain another ★ tier. The bonus is ADDITIVE
// (+20% per star) and never stops scaling, so there is no "finished" gear even
// at floor 1000+. Stars are shown separately from rarity.

import type { Enemy, Equipment } from "@/types/game";

/** Bonus per star on ITEMS (additive). ★ = +20%, ★★ = +40%, … (player stays strong). */
export const MOD_BONUS_PER_STAR = 0.2;

/**
 * Bonus per star on ENEMIES (additive). Deliberately LOWER than the item value
 * so the enemy's multiplicative growth doesn't outrun the player. This is the
 * single biggest lever against the late-game difficulty wall.
 */
export const ENEMY_MOD_BONUS_PER_STAR = 0.13;

/** How many floors between star tiers. */
export const FLOORS_PER_STAR = 50;

/** The "ambient" modifier tier available at a given floor (0 below floor 50). */
export function modTierForFloor(floor: number): number {
  if (floor < FLOORS_PER_STAR) return 0;
  return Math.floor(floor / FLOORS_PER_STAR);
}

/** Multiplier for a given star tier (additive: 1 + 0.2 * tier). */
export function modMultiplier(tier: number): number {
  return 1 + MOD_BONUS_PER_STAR * Math.max(0, tier);
}

/** "★★★" style label for a tier (empty string for 0). */
export function starLabel(tier: number): string {
  return tier > 0 ? "★".repeat(tier) : "";
}

/**
 * Roll a drop's modifier tier for a floor. Anchored to the floor's ambient tier
 * with a chance to roll one higher (bigger upswing on harder difficulties).
 */
export function rollDropModTier(floor: number, upswing = 0): number {
  const base = modTierForFloor(floor);
  if (base <= 0 && Math.random() > 0.15 + upswing) return 0;
  let tier = Math.max(0, base);
  // Upswing chance to gain an extra star.
  if (Math.random() < 0.3 + upswing) tier += 1;
  return tier;
}

/** Apply a star modifier to an equipment instance (scales stats, tags name). */
export function applyModifier(item: Equipment, tier: number): Equipment {
  if (tier <= 0) return { ...item, modTier: 0 };
  const mult = modMultiplier(tier);
  const scale = (n: number) => (n ? Math.round(n * mult) : n);
  return {
    ...item,
    attack: scale(item.attack),
    defense: scale(item.defense),
    maxHp: scale(item.maxHp),
    modTier: tier,
    name: `${item.name}${starLabel(tier)}`,
  };
}

/** Enemy modifier tier for a floor (same cadence, applied to HP/atk/drops). */
export function enemyModTierForFloor(floor: number): number {
  return modTierForFloor(floor);
}

/** Apply an enemy star modifier (HP / attack / drop rate up, name tagged). */
export function applyEnemyModifier(enemy: Enemy, tier: number): Enemy {
  if (tier <= 0) return { ...enemy, modTier: 0 };
  const mult = 1 + ENEMY_MOD_BONUS_PER_STAR * Math.max(0, tier);
  const hp = Math.round(enemy.maxHp * mult);
  return {
    ...enemy,
    maxHp: hp,
    hp,
    attack: Math.round(enemy.attack * mult),
    dropRate: Math.min(1, enemy.dropRate * (1 + 0.1 * tier)),
    modTier: tier,
    name: `${enemy.name}${starLabel(tier)}`,
  };
}
