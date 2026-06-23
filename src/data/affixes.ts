import type { Equipment } from "@/types/game";

export interface Affix {
  id: string;
  /** Prepended to the item name (Japanese adjective). */
  prefix: string;
  label: string;
  attack: number;
  defense: number;
  maxHp: number;
  rerollModifier: number;
  weight: number;
  /** Only appears on volatile items (bigger swings). */
  volatileOnly?: boolean;
}

export const AFFIXES: readonly Affix[] = [
  { id: "sharp", prefix: "鋭利な ", label: "攻+3", attack: 3, defense: 0, maxHp: 0, rerollModifier: 0, weight: 30 },
  { id: "sturdy", prefix: "頑強な ", label: "防+3", attack: 0, defense: 3, maxHp: 0, rerollModifier: 0, weight: 30 },
  { id: "vital", prefix: "生命の ", label: "HP+12", attack: 0, defense: 0, maxHp: 12, rerollModifier: 0, weight: 25 },
  { id: "lucky", prefix: "幸運の ", label: "リロール+1", attack: 0, defense: 0, maxHp: 0, rerollModifier: 1, weight: 12 },
  { id: "masterwork", prefix: "業物の ", label: "攻+6", attack: 6, defense: 0, maxHp: 0, rerollModifier: 0, weight: 8 },
  // Volatile-only big swings.
  { id: "greater_power", prefix: "剛・", label: "攻+9", attack: 9, defense: 0, maxHp: 0, rerollModifier: 0, weight: 8, volatileOnly: true },
  { id: "greater_guard", prefix: "鉄壁・", label: "防+9", attack: 0, defense: 9, maxHp: 0, rerollModifier: 0, weight: 8, volatileOnly: true },
  { id: "greater_vital", prefix: "剛健・", label: "HP+30", attack: 0, defense: 0, maxHp: 30, rerollModifier: 0, weight: 8, volatileOnly: true },
  { id: "greater_fortune", prefix: "天恵・", label: "リロール+2", attack: 0, defense: 0, maxHp: 0, rerollModifier: 2, weight: 4, volatileOnly: true },
];

const NORMAL_AFFIXES = AFFIXES.filter((a) => !a.volatileOnly);
/** The "greater" affixes — the biggest variable-stat swings (the MAX rolls). */
const GREATER_AFFIXES = AFFIXES.filter((a) => a.volatileOnly);

/** Apply a MAX-roll (greater) affix to an item — the biggest variable-stat swing. */
export function applyMaxAffix(item: Equipment): Equipment {
  return applyAffix(item, pickAffix(GREATER_AFFIXES));
}

const AFFIX_MAP: Map<string, Affix> = new Map(AFFIXES.map((a) => [a.id, a]));

export function getAffixById(id: string): Affix | null {
  return AFFIX_MAP.get(id) ?? null;
}

/** Chance that a dropped/purchased item gains an affix. */
export const AFFIX_CHANCE = 0.4;

/** Return a copy of the item with the given affix's bonuses baked in. */
export function applyAffix(base: Equipment, affix: Affix): Equipment {
  return {
    ...base,
    name: `${affix.prefix}${base.name}`,
    attack: base.attack + affix.attack,
    defense: base.defense + affix.defense,
    maxHp: base.maxHp + affix.maxHp,
    rerollModifier: base.rerollModifier + affix.rerollModifier,
    description: `${base.description}【${affix.label}】`,
    affixId: affix.id,
  };
}

function pickAffix(pool: readonly Affix[]): Affix {
  const total = pool.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * total;
  for (const a of pool) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return pool[pool.length - 1];
}

/**
 * Possibly return an affixed copy of the item.
 * Volatile items roll more often and from a wider pool (bigger swings).
 */
export function rollAffixedCopy(item: Equipment): Equipment {
  const chance = item.volatile ? 0.9 : AFFIX_CHANCE;
  if (Math.random() > chance) return item;
  const pool = item.volatile ? AFFIXES : NORMAL_AFFIXES;
  return applyAffix(item, pickAffix(pool));
}
