import { AFFIXES, applyAffix, rollAffixedCopy } from "@/data/affixes";
import { CONSUMABLES } from "@/data/consumables";
import { ITEMS, genCommon, genRarePlus, genRarePlusNear, rollGenDrop, rollSetDrop } from "@/data/items";
import { availableSetKeys } from "@/data/sets";
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

/**
 * CURATED droppables: hand-made signature gear + set pieces (the items with
 * dice effects / set bonuses). Plain stat gear is generated procedurally, so it
 * is NOT in this list — see rollLoot, which mixes curated drops with procedural.
 */
const CURATED_DROPPABLE = ITEMS.filter((i) => !i.gachaOnly && !i.casinoOnly && !i.unique);
/** Curated Rare+ gear (incl. gacha-exclusives) for the targeted pull. */
const CURATED_RAREPLUS = ITEMS.filter(
  (i) => !i.casinoOnly && !i.unique && rarityRank[i.rarity] >= rarityRank.rare,
);

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
 * Basic pull (cost {@link GACHA_COST}): a plain procedural Common. The cheap pull
 * is the material sink, never a shortcut to rare gear.
 */
export function pullGachaItem(): Equipment {
  return genCommon();
}

/**
 * Boosted pull (cost {@link PREMIUM_COST}): still Common-only, but guaranteed an
 * affix plus a ★ modifier — a "high-roll Common", never Rare+.
 */
export function pullPremiumItem(modCap = Infinity): Equipment {
  const affixed = applyAffix(genCommon(), AFFIXES[Math.floor(Math.random() * AFFIXES.length)]);
  // Modifier ★ is capped by the player's deepest floor — no future-tier gear.
  const tier = Math.min(modCap, 1 + (Math.random() < 0.35 ? 1 : 0));
  return applyModifier(affixed, Math.max(0, tier));
}

/**
 * Targeted pull (cost {@link TARGETED_COST}): pick a slot and get Rare-or-above
 * gear of that slot, guaranteed. ~40% chance of a curated Rare+ (incl.
 * exclusives) of that slot, otherwise a procedural Rare+ of that slot.
 */
export function pullTargetedItem(slot: EquipmentSlot, refTier = 0, refMod = 0): Equipment {
  // ~25% a curated effect-bearing Rare+ (incl. exclusives); otherwise a procedural
  // Rare+ scaled to the player's current best for the slot (a real side/up-grade).
  const curated = CURATED_RAREPLUS.filter((i) => i.slot === slot);
  if (curated.length > 0 && Math.random() < 0.25) {
    return withQuality(weightedPull(curated, rarePlusWeight));
  }
  if (refTier >= 16) return withQuality(genRarePlusNear(slot, refTier, refMod));
  return withQuality(genRarePlus(slot));
}

/**
 * Roll for loot after defeating an enemy. Bosses always drop; otherwise the
 * enemy's dropRate decides. Mixes curated (signature/set) gear with procedural
 * stat gear. `slotHint` biases procedural drops toward a slot (smart drops).
 */
export function rollLoot(
  enemy: Enemy,
  floor: number,
  rareBonus = 0,
  slotHint?: EquipmentSlot,
): Equipment | null {
  if (Math.random() > enemy.dropRate) return null;

  // Set-piece drop (build-defining gear). Sets unlock by depth and scale forever.
  const setChance = enemy.isBoss ? 0.18 : 0.12;
  if (availableSetKeys(floor).length > 0 && Math.random() < setChance) {
    return withQuality(rollSetDrop(floor), floor);
  }

  // Floor-gated curated pool (recent window), with fallbacks.
  const WINDOW = 20;
  let curated = CURATED_DROPPABLE.filter((i) => {
    const mf = i.minFloor ?? 1;
    return mf <= floor && mf > floor - WINDOW;
  });
  if (curated.length === 0) curated = CURATED_DROPPABLE.filter((i) => (i.minFloor ?? 1) <= floor);

  // Bosses/late floors favor a curated (effect-bearing) drop; otherwise mostly
  // procedural stat gear so the registry stays flat and gear scales with depth.
  const curatedChance = enemy.isBoss ? 0.5 : 0.35;
  if (curated.length > 0 && Math.random() < curatedChance) {
    const floorBonus = Math.min(floor * 1.5, 40) + rareBonus;
    const item = weightedPull(curated, (it) => {
      let w = RARITY_WEIGHT[it.rarity];
      if (it.rarity !== "common") w += floorBonus;
      if (enemy.isBoss && it.rarity !== "common") w += 25;
      return w;
    });
    return withQuality(item, floor);
  }

  // Procedural stat gear, floor-appropriate, optionally targeting a weak slot.
  const bias = rareBonus + (enemy.isBoss ? 25 : 0);
  return withQuality(rollAffixedCopy(rollGenDrop(floor, bias, slotHint)), floor);
}

/** Roll an Ancient/Mythic upgrade onto a (legendary) drop（深層ほど上位が出やすい）。 */
function withQuality(item: Equipment, floor = 1): Equipment {
  return applyQuality(item, rollQuality(item, floor));
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
