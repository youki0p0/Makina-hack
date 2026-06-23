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

/** 深層の敵ランプ再加速の開始tier（200 = floor 10,000）。 */
export const DEEP_RAMP_TIER = 200;
/**
 * 開始tier以降、1tier(50階)ごとに敵ランプへ加算する量。mult=1+ramp*tier なので
 * これは敵の伸びを超線形(≒二次)にし、2万階以上を段階的にかなり難しくする。
 * 例: 20,000階(tier400) で ramp +0.50、30,000階(tier600) で +1.00。
 */
export const DEEP_RAMP_SLOPE = 0.0025;

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

/**
 * Star label for a tier. Up to 5 stays as countable pips (★★★★★); from 6 it
 * switches to a compact numeric form (★6, ★7, …) so deep-floor names don't fill
 * with an uncountable wall of stars.
 */
export function starLabel(tier: number): string {
  if (tier <= 0) return "";
  if (tier < 6) return "★".repeat(tier);
  return `★${tier}`;
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
export function applyEnemyModifier(
  enemy: Enemy,
  tier: number,
  bonusPerStar: number = ENEMY_MOD_BONUS_PER_STAR,
): Enemy {
  if (tier <= 0) return { ...enemy, modTier: 0 };
  // 深層(★9以降=floor450+)は加算率を逓増させ、プレイヤーの成長に追従させる。だが
  // 逓増を青天井にすると敵HP/攻撃が floor に対して三次関数的に発散し、1000階超では
  // ステ成長(線形)で追いつけず詰む。そこで (tier-8) 項を tier20(=1000階) で頭打ちにし、
  // 1000階超は線形成長に留める。プレイヤー側は深淵到達補正(endlessAscension)で追従する。
  // ★8以下(1000階以下)は完全に不変。
  let ramp = tier <= 8 ? bonusPerStar : bonusPerStar + (Math.min(tier, 20) - 8) * 0.02;
  // ただし1万階(tier200)を超えるとプレイヤー強化が線形の敵を上回り緩くなるため、
  // tier200から ramp を再加速(超線形)させ、2万階以上を段階的にかなり難しくする。
  // mult = 1 + ramp*tier に tier 比例項が入るので、敵は深層で二次関数的に伸びる。
  ramp += Math.max(0, tier - DEEP_RAMP_TIER) * DEEP_RAMP_SLOPE;
  const mult = 1 + ramp * Math.max(0, tier);
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
