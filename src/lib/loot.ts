import { CONSUMABLES } from "@/data/consumables";
import { ITEMS } from "@/data/items";
import type { Consumable, Enemy, Equipment, Rarity } from "@/types/game";

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
    if (roll <= 0) return { ...item };
  }
  return { ...weighted[weighted.length - 1].item };
}

/**
 * Roll for loot after defeating an enemy.
 * Bosses always drop; otherwise the enemy's dropRate decides.
 */
export function rollLoot(enemy: Enemy, floor: number): Equipment | null {
  if (Math.random() > enemy.dropRate) return null;

  // Higher floors tilt the table toward better gear.
  const floorBonus = Math.min(floor * 1.5, 40);

  const weighted = DROPPABLE.map((item) => {
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
      return { ...item };
    }
  }
  return { ...weighted[weighted.length - 1].item };
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
