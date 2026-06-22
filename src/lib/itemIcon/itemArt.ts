// ===== Procedural equipment icons =====
// Goal (Noita/Brotato-style): infinite, distinctive gear that players grow
// attached to — "this 呪いの斧★★★★ looks cool" — without shipping sprites.

import type { EquipmentSlot, Quality, Rarity } from "@/types/game";
import { blank, disc, hline, rect, ring, set, vline, type Grid } from "./grid";
import { rng } from "./rng";
import { renderToCache } from "./cache";

export interface IconSpec {
  slot: EquipmentSlot;
  rarity: Rarity;
  modifierStars: number;
  setId?: string;
  unique?: boolean;
  quality?: Quality;
  /** Echo-drop gear gets a faint ghostly outline. */
  echo?: boolean;
  seed: number;
}

type Palette = { base: string; light: string; dark: string; glow: string };

const PALETTES: Record<string, Palette> = {
  common: { base: "#9ca3af", light: "#d1d5db", dark: "#5b616b", glow: "#9ca3af" },
  rare: { base: "#60a5fa", light: "#bfdbfe", dark: "#2563eb", glow: "#3b82f6" },
  epic: { base: "#c084fc", light: "#e9d5ff", dark: "#7e22ce", glow: "#a855f7" },
  legendary: { base: "#fbbf24", light: "#fef3c7", dark: "#b45309", glow: "#f59e0b" },
  cursed: { base: "#f87171", light: "#fecaca", dark: "#991b1b", glow: "#ef4444" },
  mythic: { base: "#ef4444", light: "#fecaca", dark: "#7f1d1d", glow: "#dc2626" },
  unique: { base: "#fde68a", light: "#ffffff", dark: "#1c1917", glow: "#fcd34d" },
};

function paletteFor(spec: IconSpec): Palette {
  if (spec.unique) return PALETTES.unique;
  if (spec.quality === "mythic") return PALETTES.mythic;
  return PALETTES[spec.rarity] ?? PALETTES.common;
}

/** Slot → shape family. Helm/armor/gloves/boots share the "armor" family. */
function familyOf(slot: EquipmentSlot): "weapon" | "armor" | "accessory" {
  if (slot === "weapon") return "weapon";
  if (slot === "accessory") return "accessory";
  return "armor";
}

const WEAPON_SHAPES = ["sword", "axe", "spear", "staff", "dagger", "scythe"] as const;
const ARMOR_SHAPES = ["light", "heavy", "robe", "plate", "cloak"] as const;
const ACC_SHAPES = ["ring", "pendant", "orb", "book", "feather"] as const;

// ----- Set emblems (faint background glyph) -----
function drawSetEmblem(g: Grid, setId: string, c: string) {
  if (setId === "vampire") {
    // red moon (crescent)
    ring(g, 8, 8, 6, c);
    disc(g, 10, 7, 5, null);
  } else if (setId === "oracle") {
    // eye
    hline(g, 3, 12, 8, c);
    disc(g, 8, 8, 2, c);
  } else if (setId === "executioner") {
    // cross
    vline(g, 8, 2, 13, c);
    hline(g, 4, 12, 6, c);
  } else if (setId === "gambler") {
    // die (square with pips)
    rect(g, 4, 4, 11, 11, c);
    rect(g, 5, 5, 10, 10, null);
    set(g, 6, 6, c);
    set(g, 9, 9, c);
    set(g, 9, 6, c);
    set(g, 6, 9, c);
  } else {
    // procedural rune
    vline(g, 8, 3, 12, c);
    hline(g, 5, 11, 6, c);
    set(g, 5, 9, c);
    set(g, 11, 9, c);
  }
}

// ----- Weapon shapes -----
function drawWeapon(g: Grid, shape: string, p: Palette, r: () => number) {
  const { base, light, dark } = p;
  if (shape === "sword" || shape === "dagger") {
    const top = shape === "dagger" ? 5 : 2;
    vline(g, 7, top, 11, light);
    vline(g, 8, top, 11, base);
    set(g, 7, top, light);
    hline(g, 5, 10, 11, dark); // guard
    vline(g, 7, 12, 14, dark);
    vline(g, 8, 12, 14, dark);
  } else if (shape === "spear") {
    vline(g, 7, 1, 14, dark);
    vline(g, 8, 1, 14, base);
    set(g, 7, 1, light);
    set(g, 8, 2, light);
    set(g, 6, 3, base);
    set(g, 9, 3, base);
  } else if (shape === "axe") {
    vline(g, 6, 2, 14, dark); // handle
    rect(g, 7, 3, 11, 7, base); // head
    hline(g, 7, 11, 3, light);
    rect(g, 9, 4, 11, 6, dark);
  } else if (shape === "staff") {
    vline(g, 7, 4, 14, dark);
    vline(g, 8, 4, 14, base);
    disc(g, 7, 3, 2, base);
    set(g, 7, 2, light);
  } else {
    // scythe
    vline(g, 9, 2, 14, dark);
    hline(g, 3, 9, 3, base);
    set(g, 3, 4, base);
    set(g, 4, 5, light);
  }
}

// ----- Armor shapes -----
function drawArmor(g: Grid, shape: string, p: Palette) {
  const { base, light, dark } = p;
  // chest/torso silhouette
  rect(g, 4, 4, 11, 12, base);
  hline(g, 4, 11, 4, light);
  vline(g, 4, 4, 12, light);
  hline(g, 4, 11, 12, dark);
  if (shape === "heavy" || shape === "plate") {
    // shoulder pads + center seam
    rect(g, 3, 4, 4, 6, dark);
    rect(g, 11, 4, 12, 6, dark);
    vline(g, 7, 5, 11, dark);
    vline(g, 8, 5, 11, light);
  } else if (shape === "robe") {
    vline(g, 7, 4, 12, dark);
    hline(g, 5, 10, 8, dark);
  } else if (shape === "cloak") {
    rect(g, 3, 4, 3, 12, dark);
    rect(g, 12, 4, 12, 12, dark);
  } else {
    // light: straps
    hline(g, 5, 10, 7, dark);
    hline(g, 5, 10, 9, dark);
  }
}

// ----- Accessory shapes -----
function drawAccessory(g: Grid, shape: string, p: Palette) {
  const { base, light, dark } = p;
  if (shape === "ring") {
    ring(g, 8, 9, 4, base);
    set(g, 8, 4, light); // gem
    set(g, 8, 3, light);
  } else if (shape === "pendant") {
    hline(g, 4, 12, 4, dark); // chain
    disc(g, 8, 9, 2, base);
    set(g, 8, 8, light);
  } else if (shape === "orb") {
    disc(g, 8, 8, 5, base);
    disc(g, 6, 6, 1, light);
    ring(g, 8, 8, 5, dark);
  } else if (shape === "book") {
    rect(g, 4, 4, 11, 12, base);
    vline(g, 7, 4, 12, dark);
    hline(g, 5, 6, 6, light);
    hline(g, 9, 10, 6, light);
  } else {
    // feather
    for (let i = 0; i < 8; i++) set(g, 5 + i, 12 - i, base);
    for (let i = 0; i < 6; i++) set(g, 6 + i, 12 - i, light);
    set(g, 13, 4, light);
  }
}

// ----- Modifier embellishments (★) -----
function drawStars(g: Grid, stars: number, p: Palette, fam: string) {
  if (stars >= 1) set(g, fam === "weapon" ? 7 : 8, fam === "weapon" ? 12 : 8, p.light); // gem
  if (stars >= 2) {
    set(g, 5, 11, p.light); // guard accents
    set(g, 10, 11, p.light);
  }
  if (stars >= 3) {
    // wings
    set(g, 2, 6, p.glow);
    set(g, 1, 7, p.glow);
    set(g, 13, 6, p.glow);
    set(g, 14, 7, p.glow);
  }
  if (stars >= 4) ring(g, 8, 8, 7, p.glow); // halo
  if (stars >= 5) {
    // magic circle (bottom arc)
    set(g, 4, 14, p.glow);
    set(g, 8, 15, p.glow);
    set(g, 12, 14, p.glow);
  }
}

function drawMakina(g: Grid) {
  const gold = "#fbbf24";
  const goldLight = "#fde68a";
  const black = "#1c1917";
  disc(g, 8, 8, 6, black);
  ring(g, 8, 8, 6, gold);
  // gear teeth
  for (const [x, y] of [[8, 1], [8, 14], [1, 8], [14, 8], [3, 3], [13, 3], [3, 13], [13, 13]] as const) set(g, x, y, gold);
  // fused die in center
  rect(g, 6, 6, 10, 10, black);
  ring(g, 6, 6, 0, gold);
  set(g, 7, 7, goldLight);
  set(g, 9, 9, goldLight);
  set(g, 9, 7, goldLight);
  set(g, 7, 9, goldLight);
}

/** Build the 16×16 color grid for an item spec. */
function buildGrid(spec: IconSpec): Grid {
  const g = blank();
  const p = paletteFor(spec);
  const r = rng(spec.seed >>> 0);

  if (spec.unique) {
    drawMakina(g);
    return g;
  }

  // faint set emblem behind the item
  if (spec.setId) {
    const emblem = p.dark;
    drawSetEmblem(g, spec.setId, emblem);
  }

  const fam = familyOf(spec.slot);
  if (fam === "weapon") {
    drawWeapon(g, WEAPON_SHAPES[Math.floor(r() * WEAPON_SHAPES.length)], p, r);
  } else if (fam === "armor") {
    drawArmor(g, ARMOR_SHAPES[Math.floor(r() * ARMOR_SHAPES.length)], p);
  } else {
    drawAccessory(g, ACC_SHAPES[Math.floor(r() * ACC_SHAPES.length)], p);
  }

  drawStars(g, spec.modifierStars, p, fam);
  if (spec.echo) {
    // ghostly corners
    for (const [x, y] of [[0, 0], [15, 0], [0, 15], [15, 15], [0, 8], [15, 8]] as const) set(g, x, y, "#c4b5fd");
  }
  return g;
}

function cacheKey(s: IconSpec): string {
  return [s.slot, s.rarity, s.modifierStars, s.setId ?? "", s.unique ? "u" : "", s.quality ?? "", s.echo ? "e" : "", s.seed].join("|");
}

/**
 * Render the icon to a base64 data URL (16×16, nearest-neighbor on display).
 * Cached by spec. Returns "" during SSR (no canvas).
 */
export function getItemIconDataUrl(spec: IconSpec): string {
  return renderToCache(cacheKey(spec), () => buildGrid(spec));
}
