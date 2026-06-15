// ===== Item quality tiers (Ancient / Mythic / Unique) =====
// Quality is layered ON TOP of rarity. The same Legendary base can roll as an
// ordinary Legendary, an Ancient (stronger), or — extremely rarely — a Mythic.
// Unique is reserved for one-of-a-kind items (神機マキナ).

import type { Equipment, Quality } from "@/types/game";

export interface QualityDef {
  id: Quality;
  label: string;
  /** Flat multiplier applied to attack/defense/maxHp. */
  statMult: number;
  /** Name prefix. */
  prefix: string;
}

export const QUALITIES: Record<Quality, QualityDef> = {
  ancient: { id: "ancient", label: "Ancient", statMult: 1.3, prefix: "古代の" },
  mythic: { id: "mythic", label: "Mythic", statMult: 1.6, prefix: "神話の" },
  unique: { id: "unique", label: "Unique", statMult: 1.0, prefix: "" },
};

/** Roll a quality for a freshly-dropped item (only Legendary can upgrade). */
export function rollQuality(item: Equipment): Quality | undefined {
  if (item.rarity !== "legendary") return undefined;
  const r = Math.random();
  if (r < 0.01) return "mythic"; // 1% of legendaries
  if (r < 0.13) return "ancient"; // next 12%
  return undefined;
}

/** Apply a quality's stat multiplier + name prefix to an item instance. */
export function applyQuality(item: Equipment, quality?: Quality): Equipment {
  if (!quality || quality === "unique") return quality ? { ...item, quality } : item;
  const def = QUALITIES[quality];
  const scale = (n: number) => (n ? Math.round(n * def.statMult) : n);
  return {
    ...item,
    attack: scale(item.attack),
    defense: scale(item.defense),
    maxHp: scale(item.maxHp),
    quality,
    name: `${def.prefix}${item.name}`,
  };
}
