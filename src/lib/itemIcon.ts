// ===== Procedural pixel-art item icons =====
// NO image assets. Every icon is drawn from a seed on a 16×16 canvas and scaled
// up with nearest-neighbor. Same seed ⇒ same icon. Results are cached as base64.
//
// Goal (Noita/Brotato-style): infinite, distinctive gear that players grow
// attached to — "this 呪いの斧★★★★ looks cool" — without shipping sprites.

import type { EquipmentSlot, Quality, Rarity } from "@/types/game";

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

const SIZE = 16;

/** Deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string (for deriving a seed from an item id). */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

type Grid = (string | null)[][];

function blank(): Grid {
  return Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null));
}
function set(g: Grid, x: number, y: number, c: string | null) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) g[y][x] = c;
}
function vline(g: Grid, x: number, y0: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) set(g, x, y, c);
}
function hline(g: Grid, x0: number, x1: number, y: number, c: string) {
  for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string | null) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
function disc(g: Grid, cx: number, cy: number, r: number, c: string | null) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(g, cx + x, cy + y, c);
}
function ring(g: Grid, cx: number, cy: number, r: number, c: string | null) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r && d >= (r - 1) * (r - 1)) set(g, cx + x, cy + y, c);
    }
}

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

/** Build the 16×16 color grid for a spec. */
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

// ===== Enemy / boss icons =====

export interface EnemyIconSpec {
  templateId: string;
  isBoss: boolean;
  /** 1 small / 2 great / 3 chapter (0 for normal). */
  bossRank?: number;
  modTier: number;
  seed: number;
}

type CreaturePalette = { body: string; shade: string; eye: string };
const CREATURE_PALETTES: CreaturePalette[] = [
  { body: "#65a30d", shade: "#3f6212", eye: "#fef08a" }, // slime green
  { body: "#a16207", shade: "#713f12", eye: "#fde047" }, // beast brown
  { body: "#6b7280", shade: "#374151", eye: "#f87171" }, // gray
  { body: "#7c3aed", shade: "#4c1d95", eye: "#fbcfe8" }, // arcane purple
  { body: "#dc2626", shade: "#7f1d1d", eye: "#fde68a" }, // demon red
  { body: "#0891b2", shade: "#155e75", eye: "#a5f3fc" }, // aquatic
  { body: "#e5e7eb", shade: "#9ca3af", eye: "#1f2937" }, // bone
];

const CREATURE_SHAPES = ["blob", "beast", "biped", "winged", "skull", "serpent"] as const;

function eyes(g: Grid, x0: number, x1: number, y: number, c: string) {
  set(g, x0, y, c);
  set(g, x1, y, c);
}

function drawCreature(g: Grid, shape: string, p: CreaturePalette, boss: boolean) {
  const { body, shade, eye } = p;
  if (shape === "blob") {
    disc(g, 8, 10, 5, body);
    hline(g, 4, 12, 13, shade);
    eyes(g, 6, 10, 9, eye);
  } else if (shape === "beast") {
    rect(g, 4, 7, 12, 11, body); // body
    rect(g, 4, 11, 5, 13, shade); // legs
    rect(g, 11, 11, 12, 13, shade);
    rect(g, 11, 4, 14, 7, body); // head
    eyes(g, 12, 13, 5, eye);
  } else if (shape === "biped") {
    disc(g, 8, 5, 2, body); // head
    rect(g, 6, 7, 10, 12, body); // torso
    vline(g, 6, 13, 14, shade);
    vline(g, 10, 13, 14, shade);
    eyes(g, 7, 9, 5, eye);
  } else if (shape === "winged") {
    disc(g, 8, 8, 3, body);
    for (let i = 0; i < 4; i++) {
      set(g, 4 - 0 + i, 7 - i, shade);
      set(g, 11 + i, 7 - i, shade);
    }
    eyes(g, 7, 9, 8, eye);
  } else if (shape === "skull") {
    disc(g, 8, 7, 4, body);
    rect(g, 6, 11, 10, 13, body);
    set(g, 6, 7, shade);
    set(g, 10, 7, shade);
    eyes(g, 6, 10, 7, eye);
    vline(g, 7, 11, 13, shade);
    vline(g, 9, 11, 13, shade);
  } else {
    // serpent
    for (let i = 0; i < 12; i++) set(g, 2 + i, 9 + (i % 2 === 0 ? -1 : 1), body);
    disc(g, 13, 7, 2, body);
    set(g, 13, 7, eye);
  }
  if (boss) {
    // crown / horns
    set(g, 6, 1, "#fbbf24");
    set(g, 8, 0, "#fbbf24");
    set(g, 10, 1, "#fbbf24");
  }
}

function buildEnemyGrid(spec: EnemyIconSpec): Grid {
  const g = blank();
  const r = rng(spec.seed >>> 0);
  const p = CREATURE_PALETTES[Math.floor(r() * CREATURE_PALETTES.length)];
  const shape = CREATURE_SHAPES[Math.floor(r() * CREATURE_SHAPES.length)];
  drawCreature(g, shape, p, spec.isBoss);
  // ★ aura: a sparse glow ring for modified enemies.
  if (spec.modTier > 0) {
    const glow = spec.modTier >= 3 ? "#f59e0b" : spec.modTier === 2 ? "#a855f7" : "#38bdf8";
    for (const [x, y] of [[1, 4], [14, 4], [2, 12], [13, 12], [8, 1]] as const) set(g, x, y, glow);
  }
  return g;
}

// ----- Rendering + cache -----
const cache = new Map<string, string>();

function gridToDataUrl(grid: Grid): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = grid[y][x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas.toDataURL("image/png");
}

/** Render an enemy/boss icon to a cached base64 data URL. */
export function getEnemyIconDataUrl(spec: EnemyIconSpec): string {
  const key = ["enemy", spec.templateId, spec.isBoss ? "b" : "", spec.bossRank ?? 0, spec.modTier, spec.seed].join("|");
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  const url = gridToDataUrl(buildEnemyGrid(spec));
  cache.set(key, url);
  return url;
}

function cacheKey(s: IconSpec): string {
  return [s.slot, s.rarity, s.modifierStars, s.setId ?? "", s.unique ? "u" : "", s.quality ?? "", s.echo ? "e" : "", s.seed].join("|");
}

/**
 * Render the icon to a base64 data URL (16×16, nearest-neighbor on display).
 * Cached by spec. Returns "" during SSR (no canvas).
 */
export function getItemIconDataUrl(spec: IconSpec): string {
  const key = cacheKey(spec);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  const url = gridToDataUrl(buildGrid(spec));
  cache.set(key, url);
  return url;
}

// ===== UI glyphs (replace emoji with pixel art) =====
// Small procedural icons for stats, currencies, statuses and navigation, so the
// UI uses the same pixel-art language as items/enemies — no emoji.

export type GlyphKind =
  | "attack"
  | "defense"
  | "hp"
  | "dice"
  | "gold"
  | "material"
  | "soul"
  | "drop"
  | "fire"
  | "poison"
  | "stun"
  | "weaken"
  | "heal"
  | "shop"
  | "casino"
  | "codex"
  | "lock"
  | "unlock"
  | "ghost"
  | "ranking"
  | "home"
  | "help"
  | "crown"
  | "star"
  | "bag"
  | "card"
  | "save"
  | "rainbow";

const GC = {
  white: "#e5e7eb",
  gray: "#9ca3af",
  dgray: "#4b5563",
  red: "#ef4444",
  green: "#22c55e",
  dgreen: "#15803d",
  blue: "#60a5fa",
  bluel: "#bfdbfe",
  gold: "#fbbf24",
  goldd: "#b45309",
  cyan: "#22d3ee",
  indigo: "#818cf8",
  orange: "#fb923c",
  lime: "#a3e635",
  yellow: "#fde047",
  violet: "#c084fc",
  fuchsia: "#e879f9",
  emerald: "#34d399",
  sky: "#7dd3fc",
};

const GLYPHS: Record<GlyphKind, (g: Grid) => void> = {
  attack: (g) => {
    vline(g, 8, 2, 9, GC.white);
    set(g, 7, 3, GC.gray);
    hline(g, 6, 10, 10, GC.dgray);
    vline(g, 8, 11, 13, GC.goldd);
  },
  defense: (g) => {
    rect(g, 5, 3, 10, 8, GC.blue);
    hline(g, 5, 10, 3, GC.bluel);
    set(g, 6, 9, GC.blue); set(g, 9, 9, GC.blue);
    hline(g, 7, 8, 10, GC.blue); hline(g, 7, 8, 11, GC.blue); set(g, 8, 12, GC.blue);
  },
  hp: (g) => {
    disc(g, 6, 6, 2, GC.red); disc(g, 9, 6, 2, GC.red);
    rect(g, 4, 6, 11, 8, GC.red);
    for (let y = 9; y <= 12; y++) { const ins = y - 8; hline(g, 4 + ins, 11 - ins, y, GC.red); }
    set(g, 6, 5, "#fca5a5");
  },
  dice: (g) => {
    rect(g, 4, 4, 11, 11, GC.white);
    rect(g, 5, 5, 10, 10, "#cbd5e1");
    set(g, 6, 6, GC.dgray); set(g, 9, 9, GC.dgray); set(g, 9, 6, GC.dgray); set(g, 6, 9, GC.dgray);
  },
  gold: (g) => {
    disc(g, 8, 8, 5, GC.gold); ring(g, 8, 8, 5, GC.goldd);
    set(g, 6, 6, "#fde68a"); vline(g, 8, 6, 10, GC.goldd);
  },
  material: (g) => {
    rect(g, 5, 5, 10, 7, GC.cyan);
    for (let y = 8; y <= 12; y++) { const ins = y - 7; hline(g, 5 + ins, 10 - ins, y, GC.cyan); }
    set(g, 6, 6, "#cffafe");
  },
  soul: (g) => {
    disc(g, 8, 8, 5, GC.indigo); ring(g, 8, 8, 5, "#4338ca"); set(g, 6, 6, "#c7d2fe");
  },
  drop: (g) => {
    rect(g, 4, 7, 11, 12, GC.green); rect(g, 4, 5, 11, 6, GC.dgreen);
    vline(g, 7, 5, 12, GC.dgreen); vline(g, 8, 5, 12, GC.dgreen);
    set(g, 6, 4, GC.green); set(g, 9, 4, GC.green);
  },
  fire: (g) => {
    set(g, 8, 3, GC.yellow); disc(g, 8, 9, 3, GC.orange);
    set(g, 8, 5, GC.orange); set(g, 7, 6, GC.orange); set(g, 9, 6, GC.orange);
    disc(g, 8, 10, 1, GC.yellow);
  },
  poison: (g) => {
    disc(g, 8, 7, 4, GC.lime); rect(g, 6, 11, 10, 12, GC.lime);
    set(g, 6, 7, "#3f6212"); set(g, 10, 7, "#3f6212"); set(g, 8, 9, "#3f6212");
    set(g, 7, 12, null); set(g, 9, 12, null);
  },
  stun: (g) => {
    const pts: [number, number][] = [[9, 3], [8, 4], [7, 5], [8, 6], [7, 7], [6, 8], [8, 8], [7, 9], [6, 10], [7, 11]];
    for (const [x, y] of pts) set(g, x, y, GC.yellow);
  },
  weaken: (g) => {
    vline(g, 7, 3, 9, GC.violet); vline(g, 8, 3, 9, GC.violet);
    set(g, 6, 9, GC.violet); set(g, 9, 9, GC.violet); set(g, 7, 10, GC.violet); set(g, 8, 10, GC.violet); set(g, 7, 11, GC.violet); set(g, 8, 11, GC.violet);
  },
  heal: (g) => {
    vline(g, 7, 4, 11, GC.green); vline(g, 8, 4, 11, GC.green);
    hline(g, 5, 10, 7, GC.green); hline(g, 5, 10, 8, GC.green);
  },
  shop: (g) => {
    rect(g, 5, 6, 10, 12, GC.gold); hline(g, 5, 10, 6, GC.goldd);
    set(g, 6, 5, GC.goldd); set(g, 9, 5, GC.goldd); set(g, 7, 4, GC.goldd); set(g, 8, 4, GC.goldd);
  },
  casino: (g) => {
    hline(g, 5, 10, 4, GC.fuchsia); vline(g, 9, 5, 7, GC.fuchsia); vline(g, 8, 8, 11, GC.fuchsia); set(g, 7, 11, GC.fuchsia);
  },
  codex: (g) => {
    rect(g, 4, 4, 11, 12, GC.sky);
    vline(g, 7, 4, 12, "#0369a1"); vline(g, 8, 4, 12, "#0369a1");
    hline(g, 5, 6, 6, GC.white); hline(g, 9, 10, 6, GC.white); hline(g, 5, 6, 9, GC.white); hline(g, 9, 10, 9, GC.white);
  },
  lock: (g) => {
    ring(g, 8, 6, 2, GC.gray); rect(g, 5, 7, 11, 12, GC.gold);
    set(g, 8, 9, GC.goldd); set(g, 8, 10, GC.goldd);
  },
  unlock: (g) => {
    ring(g, 10, 5, 2, GC.gray); set(g, 8, 5, null); set(g, 8, 6, null);
    rect(g, 5, 7, 11, 12, GC.gray); set(g, 8, 9, GC.dgray);
  },
  ghost: (g) => {
    disc(g, 8, 7, 4, GC.fuchsia); rect(g, 4, 7, 11, 11, GC.fuchsia);
    set(g, 6, 7, GC.white); set(g, 10, 7, GC.white);
    set(g, 5, 12, GC.fuchsia); set(g, 7, 12, GC.fuchsia); set(g, 9, 12, GC.fuchsia); set(g, 11, 12, GC.fuchsia);
  },
  ranking: (g) => {
    rect(g, 3, 11, 4, 12, GC.emerald);
    rect(g, 6, 9, 7, 12, GC.emerald);
    rect(g, 9, 6, 10, 12, GC.emerald);
    rect(g, 12, 3, 13, 12, GC.emerald);
  },
  home: (g) => {
    for (let i = 0; i <= 4; i++) hline(g, 8 - i, 8 + i, 3 + i, GC.gray);
    rect(g, 5, 8, 11, 13, GC.gray); rect(g, 7, 10, 9, 13, "#1f2937");
  },
  help: (g) => {
    hline(g, 6, 9, 4, GC.sky); set(g, 10, 5, GC.sky); set(g, 10, 6, GC.sky);
    set(g, 9, 7, GC.sky); set(g, 8, 8, GC.sky); set(g, 8, 9, GC.sky); set(g, 8, 11, GC.sky);
  },
  crown: (g) => {
    hline(g, 4, 11, 11, GC.gold);
    vline(g, 4, 7, 11, GC.gold); vline(g, 11, 7, 11, GC.gold); vline(g, 8, 7, 11, GC.gold);
    set(g, 4, 7, GC.gold); set(g, 8, 6, GC.gold); set(g, 11, 7, GC.gold); set(g, 6, 9, GC.gold); set(g, 9, 9, GC.gold);
  },
  star: (g) => {
    set(g, 8, 3, GC.gold); vline(g, 8, 3, 5, GC.gold);
    hline(g, 4, 11, 7, GC.gold);
    set(g, 7, 8, GC.gold); set(g, 9, 8, GC.gold); set(g, 6, 9, GC.gold); set(g, 10, 9, GC.gold);
    set(g, 6, 11, GC.gold); set(g, 10, 11, GC.gold);
  },
  bag: (g) => {
    rect(g, 4, 6, 11, 13, GC.goldd);
    rect(g, 4, 6, 11, 8, GC.gold);
    set(g, 6, 5, GC.goldd); set(g, 9, 5, GC.goldd); set(g, 7, 4, GC.goldd); set(g, 8, 4, GC.goldd);
    hline(g, 6, 9, 10, GC.gold);
  },
  card: (g) => {
    rect(g, 4, 3, 11, 13, GC.white);
    rect(g, 4, 3, 11, 3, "#cbd5e1");
    // red suit pip
    disc(g, 7, 7, 1, GC.red); disc(g, 9, 7, 1, GC.red); set(g, 8, 9, GC.red); set(g, 7, 8, GC.red); set(g, 9, 8, GC.red);
  },
  save: (g) => {
    rect(g, 3, 3, 12, 12, GC.blue);
    rect(g, 5, 3, 10, 6, "#e5e7eb"); // label
    rect(g, 8, 3, 9, 5, "#1e3a8a"); // slider
    rect(g, 5, 8, 10, 12, "#1e40af"); // disc area
  },
  rainbow: (g) => {
    const cols = [GC.red, GC.orange, GC.yellow, GC.green, GC.cyan, GC.violet];
    for (let i = 0; i < 6; i++) ring(g, 8, 13, 6 - i, cols[i]);
    rect(g, 0, 11, 15, 15, null);
    for (let i = 0; i < 6; i++) { const r = 6 - i; for (let x = -r; x <= r; x++) { const y = -Math.round(Math.sqrt(Math.max(0, r * r - x * x))); set(g, 8 + x, 11 + y, cols[i]); } }
  },
};

/** Render a UI glyph to a cached base64 data URL. */
export function getGlyphIconDataUrl(kind: GlyphKind): string {
  const key = "glyph|" + kind;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  const g = blank();
  (GLYPHS[kind] ?? GLYPHS.star)(g);
  const url = gridToDataUrl(g);
  cache.set(key, url);
  return url;
}
