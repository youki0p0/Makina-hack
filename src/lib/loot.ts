import { AFFIXES, applyAffix, rollAffixedCopy } from "@/data/affixes";
import { CONSUMABLES } from "@/data/consumables";
import { ITEMS } from "@/data/items";
import { applyModifier } from "@/data/modifiers";
import { applyQuality, rollQuality } from "@/data/quality";
import { rarityRank } from "@/lib/ui";
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

/** Items that can drop from enemies (gacha/casino/unique items excluded). */
const DROPPABLE = ITEMS.filter((i) => !i.gachaOnly && !i.casinoOnly && !i.unique);

/** Items obtainable from the equipment gacha (casino prizes & uniques excluded). */
const GACHA_POOL = ITEMS.filter((i) => !i.casinoOnly && !i.unique);

/** Gacha currency gained by scrapping equipment, by rarity. */
export const SCRAP_VALUE: Record<Rarity, number> = {
  common: 1,
  rare: 3,
  epic: 6,
  cursed: 5,
  legendary: 12,
};

/** Basic pull (cost {@link GACHA_COST}): mass-produces Common gear only. */
export const GACHA_COST = 10;
/** Boosted pull (cost {@link PREMIUM_COST}): high-roll Commons, never Rare+. */
export const PREMIUM_COST = 100;
/** Targeted pull (cost {@link TARGETED_COST}): chosen slot, Rare+ guaranteed. */
export const TARGETED_COST = 250;

/** Common-only gacha pool (the 10/100 pulls). */
const COMMON_POOL = GACHA_POOL.filter((i) => i.rarity === "common");
/** Rare-and-above gacha pool (the 250 targeted pull). */
const RAREPLUS_POOL = GACHA_POOL.filter((i) => rarityRank[i.rarity] >= rarityRank.rare);

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

/** Premium weighting among Rare+ gear: favor epic/legendary + exclusives. */
function rarePlusWeight(item: Equipment): number {
  let w = RARITY_WEIGHT[item.rarity];
  if (item.rarity === "epic") w += 30;
  else if (item.rarity === "legendary") w += 25;
  else if (item.rarity === "cursed") w += 12;
  if (item.gachaOnly) w += 25;
  return w;
}

/**
 * Basic pull (cost {@link GACHA_COST}): a plain Common. The cheap pull is the
 * material sink, never a shortcut to rare gear — this is what makes spamming
 * 10-pulls a poor strategy compared to saving for the targeted pull.
 */
export function pullGachaItem(): Equipment {
  return weightedPull(COMMON_POOL, (i) => RARITY_WEIGHT[i.rarity] + (i.gachaOnly ? 10 : 0));
}

/**
 * Boosted pull (cost {@link PREMIUM_COST}): still Common-only, but guaranteed an
 * affix plus a ★ modifier — a "high-roll Common", never Rare+.
 */
export function pullPremiumItem(modCap = Infinity): Equipment {
  const base = weightedPull(COMMON_POOL, (i) => RARITY_WEIGHT[i.rarity]);
  const affixed = applyAffix(base, AFFIXES[Math.floor(Math.random() * AFFIXES.length)]);
  // Modifier ★ is capped by the player's deepest floor — no future-tier gear.
  const tier = Math.min(modCap, 1 + (Math.random() < 0.35 ? 1 : 0));
  return applyModifier(affixed, Math.max(0, tier));
}

/**
 * Targeted pull (cost {@link TARGETED_COST}): pick a slot and get Rare-or-above
 * gear of that slot, guaranteed. The only reliable route to high-rarity items.
 */
export function pullTargetedItem(slot: EquipmentSlot): Equipment {
  const pool = RAREPLUS_POOL.filter((i) => i.slot === slot);
  if (pool.length === 0) return weightedPull(RAREPLUS_POOL, rarePlusWeight);
  return weightedPull(pool, rarePlusWeight);
}

/**
 * Roll for loot after defeating an enemy.
 * Bosses always drop; otherwise the enemy's dropRate decides.
 */
export function rollLoot(enemy: Enemy, floor: number, rareBonus = 0): Equipment | null {
  if (Math.random() > enemy.dropRate) return null;

  // Higher floors tilt the table toward better gear; difficulty adds rareBonus.
  const floorBonus = Math.min(floor * 1.5, 40) + rareBonus;

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
      return withQuality(rollAffixedCopy({ ...item }));
    }
  }
  return withQuality(rollAffixedCopy({ ...weighted[weighted.length - 1].item }));
}

/** Roll an Ancient/Mythic upgrade onto a (legendary) drop. */
function withQuality(item: Equipment): Equipment {
  return applyQuality(item, rollQuality(item));
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
