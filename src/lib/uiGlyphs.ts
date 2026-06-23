// Maps game data (classes, consumables) and free-text emoji to pixel glyphs,
// so the whole UI — including dynamic battle-log text — drops emoji.

import type { GlyphKind } from "@/lib/itemIcon";
import type { ClassId, ConsumableKind } from "@/types/game";

/** Pixel glyph standing in for each class's icon. */
export function classGlyphKind(id: ClassId): GlyphKind {
  switch (id) {
    case "warrior":
      return "attack";
    case "rogue":
      return "dice";
    case "mage":
      return "soul";
    case "berserker":
      return "fire";
    case "paladin":
      return "defense";
    case "hexer":
      return "poison";
    case "swordsaint":
      return "attack";
    case "archmage":
      return "soul";
    case "warlord":
      return "fire";
    case "celestial":
      return "heal";
    case "abyssal":
      return "soul";
    default:
      return "star"; // adventurer
  }
}

/** Pixel glyph for each consumable kind. */
export function consumableGlyphKind(kind: ConsumableKind): GlyphKind {
  switch (kind) {
    case "heal":
      return "heal";
    case "attack":
      return "attack";
    case "defense":
      return "defense";
    case "reroll":
      return "dice";
    default:
      return "star"; // luck
  }
}

/** Emoji → glyph map for converting free-text (battle log, help, etc.). */
export const EMOJI_GLYPH: Record<string, GlyphKind> = {
  "🎆": "firework",
  "🎇": "firework",
  "⚔️": "attack",
  "🛡️": "defense",
  "🎲": "dice",
  "💰": "gold",
  "🔥": "fire",
  "☠️": "poison",
  "⚡": "stun",
  "🔻": "weaken",
  "🔮": "soul",
  "🎁": "drop",
  "🏅": "star",
  "💾": "save",
  "✨": "heal",
  "🌈": "rainbow",
  "❤️": "hp",
  "🏪": "shop",
  "🎰": "casino",
  "🃏": "card",
  "🔒": "lock",
  "🔓": "unlock",
  "👤": "ghost",
  "📡": "ranking",
  "🏠": "home",
  "❓": "help",
  "👑": "crown",
  "📚": "codex",
  "🗺️": "ranking",
  "🩸": "hp",
  "🏔️": "crown",
  "🚪": "home",
  "💥": "attack",
  "🗡️": "attack",
  "🐲": "crown",
  "♻️": "soul",
  "📦": "bag",
  "⭐": "star",
  "💎": "material",
  "🔷": "material",
  "🍀": "star",
  "🪄": "soul",
  "✝️": "defense",
  "🧭": "star",
  "🌍": "codex",
  "🦇": "ghost",
  "🪓": "attack",
  "🜲": "soul",
};
