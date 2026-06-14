import type { ArtifactId, ArtifactLevels, StatBonus } from "@/types/game";

export interface ArtifactDef {
  id: ArtifactId;
  name: string;
  icon: string;
  stat: keyof StatBonus;
  /** Stat added per level. */
  perLevel: number;
  /** Soul cost for the first level; scales with level. */
  baseCost: number;
  maxLevel: number;
  description: string;
}

/**
 * Artifacts are permanent meta-progression: they persist across rebirths,
 * give tiny passive boosts, and don't occupy equipment slots.
 */
export const ARTIFACTS: readonly ArtifactDef[] = [
  {
    id: "might",
    name: "力の結晶",
    icon: "💎",
    stat: "attack",
    perLevel: 1,
    baseCost: 3,
    maxLevel: 20,
    description: "攻撃力 +1 / Lv",
  },
  {
    id: "guard",
    name: "守りの結晶",
    icon: "🔷",
    stat: "defense",
    perLevel: 1,
    baseCost: 3,
    maxLevel: 20,
    description: "防御 +1 / Lv",
  },
  {
    id: "vitality",
    name: "生命の結晶",
    icon: "❤️",
    stat: "maxHp",
    perLevel: 4,
    baseCost: 3,
    maxLevel: 20,
    description: "最大HP +4 / Lv",
  },
  {
    id: "fortune",
    name: "幸運の結晶",
    icon: "🍀",
    stat: "reroll",
    perLevel: 1,
    baseCost: 25,
    maxLevel: 2,
    description: "リロール +1 / Lv",
  },
];

const ARTIFACT_MAP: Map<ArtifactId, ArtifactDef> = new Map(ARTIFACTS.map((a) => [a.id, a]));

export function defaultArtifactLevels(): ArtifactLevels {
  return { might: 0, guard: 0, vitality: 0, fortune: 0 };
}

/** Normalize possibly-partial saved data into a full ArtifactLevels. */
export function normalizeArtifacts(levels?: Partial<ArtifactLevels>): ArtifactLevels {
  const base = defaultArtifactLevels();
  if (!levels) return base;
  for (const a of ARTIFACTS) {
    const v = levels[a.id];
    if (typeof v === "number" && v >= 0) base[a.id] = Math.min(a.maxLevel, Math.floor(v));
  }
  return base;
}

/** Soul cost to raise an artifact from its current level to the next. */
export function artifactUpgradeCost(id: ArtifactId, currentLevel: number): number {
  const def = ARTIFACT_MAP.get(id);
  if (!def) return Infinity;
  return def.baseCost * (currentLevel + 1);
}

/** The total flat stat bonus from all owned artifacts. */
export function artifactBonus(levels: ArtifactLevels): StatBonus {
  const bonus: StatBonus = { attack: 0, defense: 0, maxHp: 0, reroll: 0 };
  for (const a of ARTIFACTS) {
    const lvl = levels[a.id] ?? 0;
    bonus[a.stat] += a.perLevel * lvl;
  }
  return bonus;
}

/** Souls earned by rebirthing from the given run progress. */
export function computeRebirthGain(floor: number, level: number): number {
  return Math.max(0, floor - 1) + level * 2;
}
