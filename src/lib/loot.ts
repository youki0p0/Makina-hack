import { rollAffixedCopy } from "@/data/affixes";
import { CONSUMABLES } from "@/data/consumables";
import { ITEMS } from "@/data/items";
import type {
  Consumable,
  Enemy,
  Equipment,
  EquipmentSlot,
  Rarity,
} from "@/types/game";

/** Relative weight of each rarity in the drop table. */
const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50,
  rare: 28,
  epic: 12,
  cursed: 7,
  legendary: 3,
};

/** Items that can drop from enemies (gacha/casino-exclusive items excluded). */
const DROPPABLE = ITEMS.filter((i) => !i.gachaOnly && !i.casinoOnly);

/** Items obtainable from the equipment gacha (casino prizes excluded). */
const GACHA_POOL = ITEMS.filter((i) => !i.casinoOnly);

/** Gacha currency gained by scrapping equipment, by rarity. */
export const SCRAP_VALUE: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  cursed: 5,
  legendary: 12,
};

/** Cost of a single gacha pull. */
export const GACHA_COST = 10;
/** Premium gacha: pricier, much higher rate for epic/legendary. */
export const PREMIUM_COST = 100;
/** Targeted gacha: pick a slot and pull a high-rarity item of that slot. */
export const TARGETED_COST = 250;

/** Weighted random pick from a pool, returning an affixed copy. */
function weightedPull(
  pool: Equipment[],
  weightOf: (item: Equipment) => number,
): Equipment {
  const weighted = pool.map((item) => ({ item, weight: Math.max(0.01, weightOf(item)) }));
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const { item, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return rollAffixedCopy({ ...item });
  }
  return rollAffixedCopy({ ...weighted[weighted.length - 1].item });
}

/** Premium weighting: crush commons, heavily favor epic/legendary + exclusives. */
function premiumWeight(item: Equipment): number {
  let w = RARITY_WEIGHT[item.rarity];
  if (item.rarity === "common") w *= 0.15;
  else if (item.rarity === "rare") w *= 0.7;
  else if (item.rarity === "epic") w += 45;
  else if (item.rarity === "legendary") w += 35;
  else if (item.rarity === "cursed") w += 15;
  if (item.gachaOnly) w += 30;
  return w;
}

/** Premium pull (cost {@link PREMIUM_COST}): boosted high-rarity rate. */
export function pullPremiumItem(): Equipment {
  return weightedPull(GACHA_POOL, premiumWeight);
}

/** Targeted pull (cost {@link TARGETED_COST}): a chosen slot, premium rates. */
export function pullTargetedItem(slot: EquipmentSlot): Equipment {
  const pool = GACHA_POOL.filter((i) => i.slot === slot);
  if (pool.length === 0) return pullPremiumItem();
  return weightedPull(pool, premiumWeight);
}

/**
 * Pull a single equipment from the gacha. Includes gacha-exclusive items and
 * tilts toward rarer gear than normal drops.
 */
export function pullGachaItem(): Equipment {
  const weighted = GACHA_POOL.map((item) => {
    let weight = RARITY_WEIGHT[item.rarity];
    // Gacha leans premium: boost rare+ and make exclusives meaningfully likely.
    if (item.rarity !== "common") weight += 10;
    if (item.gachaOnly) weight += 20;
    return { item, weight };
  });
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const { item, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return rollAffixedCopy({ ...item });
  }
  return rollAffixedCopy({ ...weighted[weighted.length - 1].item });
}

/**
 * Roll for loot after defeating an enemy.
 * Bosses always drop; otherwise the enemy's dropRate decides.
 */
export function rollLoot(enemy: Enemy, floor: number): Equipment | null {
  if (Math.random() > enemy.dropRate) return null;

  // Higher floors tilt the table toward better gear.
  const floorBonus = Math.min(floor * 1.5, 40);

  // Floor-gated pool: items unlocked by this floor, within a recent window so
  // low-tier gear phases out as you descend. Fall back to all unlocked items.
  const WINDOW = 20;
  let pool = DROPPABLE.filter((i) => {
    const mf = i.minFloor ?? 1;
    return mf <= floor && mf > floor - WINDOW;
  });
  if (pool.length === 0) {
    pool = DROPPABLE.filter((i) => (i.minFloor ?? 1) <= floor);
  }
  if (pool.length === 0) pool = DROPPABLE.filter((i) => (i.minFloor ?? 1) <= 1);

  const weighted = pool.map((item) => {
    let weight = RARITY_WEIGHT[item.rarity];
    if (item.rarity === "epic" || item.rarity === "legendary" || item.rarity === "cursed") {
      weight += floorBonus;
    }
    if (enemy.isBoss && item.rarity !== "common") {
      weight += 25;
    }
    return { item, weight };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const { item, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      return rollAffixedCopy({ ...item });
    }
  }
  return rollAffixedCopy({ ...weighted[weighted.length - 1].item });
}

/**
 * Roll for a consumable after victory (independent of the equipment drop).
 * Consumables are auto-used on pickup, so this just decides what to apply.
 */
export function rollConsumable(enemy: Enemy): Consumable | null {
  const chance = enemy.isBoss ? 0.6 : 0.3;
  if (Math.random() > chance) return null;

  const weighted = CONSUMABLES.map((c) => ({ c, weight: RARITY_WEIGHT[c.rarity] }));
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const { c, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) {
      return { ...c };
    }
  }
  return { ...weighted[weighted.length - 1].c };
}
