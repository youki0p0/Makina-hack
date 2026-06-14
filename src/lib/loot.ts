import { ITEMS } from "@/data/items";
import type { Enemy, Equipment, Rarity } from "@/types/game";

/** Relative weight of each rarity in the drop table. */
const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 50,
  rare: 28,
  epic: 12,
  cursed: 7,
  legendary: 3,
};

/**
 * Roll for loot after defeating an enemy.
 * Bosses always drop; otherwise the enemy's dropRate decides.
 */
export function rollLoot(enemy: Enemy, floor: number): Equipment | null {
  if (Math.random() > enemy.dropRate) return null;

  // Higher floors tilt the table toward better gear.
  const floorBonus = Math.min(floor * 1.5, 40);

  const weighted = ITEMS.map((item) => {
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
