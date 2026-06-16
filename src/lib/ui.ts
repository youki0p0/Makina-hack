import type { DiceKind, Equipment, Rarity } from "@/types/game";

/** Thousands-separated number for readable deep-floor values (1234 → "1,234"). */
export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** Stable key for an item instance (base id + affix + ★ tier), used for locks. */
export function itemKey(item: Equipment): string {
  return `${item.id}:${item.affixId ?? ""}:${item.modTier ?? 0}:${item.forgeLevel ?? 0}`;
}

/** Sort rank for rarity (higher = rarer). */
export const rarityRank: Record<Rarity, number> = {
  legendary: 5,
  epic: 4,
  cursed: 3,
  rare: 2,
  common: 1,
};

/** ✦-pip count per rarity for at-a-glance readability (#13). */
export const rarityPips: Record<Rarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  cursed: 2,
};

/** "✦✦✦" pip string for a rarity. */
export function rarityPipString(rarity: Rarity): string {
  return "✦".repeat(rarityPips[rarity]);
}

export const rarityLabel: Record<Rarity, string> = {
  common: "コモン",
  rare: "レア",
  epic: "エピック",
  legendary: "レジェンド",
  cursed: "呪い",
};

/** Tailwind classes for rarity-colored borders/text. */
export const rarityStyle: Record<Rarity, { text: string; border: string; bg: string }> = {
  common: { text: "text-gray-300", border: "border-gray-500/60", bg: "bg-gray-500/10" },
  rare: { text: "text-blue-300", border: "border-blue-500/60", bg: "bg-blue-500/10" },
  epic: { text: "text-purple-300", border: "border-purple-500/60", bg: "bg-purple-500/10" },
  legendary: { text: "text-amber-300", border: "border-amber-500/60", bg: "bg-amber-500/10" },
  cursed: { text: "text-red-400", border: "border-red-600/60", bg: "bg-red-600/10" },
};

export const slotLabel: Record<string, string> = {
  weapon: "武器",
  helm: "兜",
  armor: "鎧",
  gloves: "篭手",
  boots: "靴",
  accessory: "装飾",
};

/** Accent color per dice kind for the big dice readout. */
export const diceKindColor: Record<DiceKind, string> = {
  miss: "text-gray-400",
  small: "text-sky-300",
  normal: "text-emerald-300",
  strong: "text-orange-300",
  critical: "text-yellow-300",
  skill: "text-fuchsia-300",
  fireball: "text-red-400",
  defend: "text-blue-300",
  selfDamage: "text-red-500",
  stun: "text-yellow-300",
  weaken: "text-violet-300",
};
