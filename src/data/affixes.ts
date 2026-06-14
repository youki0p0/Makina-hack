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
}

export const AFFIXES: readonly Affix[] = [
  { id: "sharp", prefix: "鋭利な ", label: "攻+3", attack: 3, defense: 0, maxHp: 0, rerollModifier: 0, weight: 30 },
  { id: "sturdy", prefix: "頑強な ", label: "防+3", attack: 0, defense: 3, maxHp: 0, rerollModifier: 0, weight: 30 },
  { id: "vital", prefix: "生命の ", label: "HP+12", attack: 0, defense: 0, maxHp: 12, rerollModifier: 0, weight: 25 },
  { id: "lucky", prefix: "幸運の ", label: "リロール+1", attack: 0, defense: 0, maxHp: 0, rerollModifier: 1, weight: 12 },
  { id: "masterwork", prefix: "業物の ", label: "攻+6", attack: 6, defense: 0, maxHp: 0, rerollModifier: 0, weight: 8 },
];

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

function pickAffix(): Affix {
  const total = AFFIXES.reduce((sum, a) => sum + a.weight, 0);
  let roll = Math.random() * total;
  for (const a of AFFIXES) {
    roll -= a.weight;
    if (roll <= 0) return a;
  }
  return AFFIXES[AFFIXES.length - 1];
}

/** Possibly return an affixed copy of the item (AFFIX_CHANCE), else the item as-is. */
export function rollAffixedCopy(item: Equipment): Equipment {
  if (Math.random() > AFFIX_CHANCE) return item;
  return applyAffix(item, pickAffix());
}
