import type { DiceKind, Rarity } from "@/types/game";

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
  armor: "防具",
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
};
