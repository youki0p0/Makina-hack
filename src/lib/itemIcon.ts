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

// Named palettes so each creature can keep a colour that matches its identity
// (a slime is green, a skeleton is bone-white, a dragon is red …).
const CP: Record<string, CreaturePalette> = {
  slimeGreen: { body: "#65a30d", shade: "#3f6212", eye: "#fef9c3" },
  slimeTeal: { body: "#14b8a6", shade: "#0f766e", eye: "#ccfbf1" },
  goblinGreen: { body: "#4d7c0f", shade: "#365314", eye: "#fde047" },
  oliveGreen: { body: "#5b6e1f", shade: "#3f4d12", eye: "#fde047" },
  poisonGreen: { body: "#65a30d", shade: "#365314", eye: "#bef264" },
  beastBrown: { body: "#a16207", shade: "#713f12", eye: "#fde047" },
  furGray: { body: "#9ca3af", shade: "#4b5563", eye: "#fca5a5" },
  rockGray: { body: "#6b7280", shade: "#374151", eye: "#fbbf24" },
  bone: { body: "#e5e7eb", shade: "#9ca3af", eye: "#1f2937" },
  redCap: { body: "#dc2626", shade: "#991b1b", eye: "#1f2937" },
  demonRed: { body: "#dc2626", shade: "#7f1d1d", eye: "#fde68a" },
  bloodRed: { body: "#b91c1c", shade: "#7f1d1d", eye: "#fef08a" },
  demonPurple: { body: "#7c3aed", shade: "#4c1d95", eye: "#fbcfe8" },
  arcanePurple: { body: "#a855f7", shade: "#6b21a8", eye: "#f5d0fe" },
  aqua: { body: "#0891b2", shade: "#155e75", eye: "#a5f3fc" },
  ghostPale: { body: "#dbeafe", shade: "#93c5fd", eye: "#1e3a8a" },
  shadow: { body: "#334155", shade: "#1e293b", eye: "#f87171" },
  fireOrange: { body: "#f97316", shade: "#c2410c", eye: "#fef08a" },
  iceBlue: { body: "#38bdf8", shade: "#0369a1", eye: "#e0f2fe" },
  gold: { body: "#fbbf24", shade: "#b45309", eye: "#fffbeb" },
};

const BONE = "#e9eaec";
const FANG = "#f8fafc";

type CreatureKind =
  | "slime" | "bat" | "rodent" | "goblinoid" | "spider" | "serpent" | "wolf"
  | "skeleton" | "zombie" | "demon" | "boar" | "ghost" | "mushroom" | "scorpion"
  | "crab" | "bee" | "mummy" | "giant" | "harpy" | "lizard" | "gargoyle"
  | "vampire" | "golem" | "minotaur" | "wisp" | "knight" | "robed" | "tentacle"
  | "dragon" | "bird" | "angel" | "beast";

type CreatureOpt = "one" | "multi" | "crown" | "skull" | "void";

interface EnemyArt {
  kind: CreatureKind;
  pal: keyof typeof CP;
  opt?: CreatureOpt;
}

// Every enemy/boss id mapped to a recognisable silhouette + fitting palette, so
// the dot-art matches what the name evokes instead of a random shape.
const ENEMY_ART: Record<string, EnemyArt> = {
  slime: { kind: "slime", pal: "slimeGreen" },
  bat: { kind: "bat", pal: "shadow" },
  rat: { kind: "rodent", pal: "furGray" },
  goblin: { kind: "goblinoid", pal: "goblinGreen" },
  spider: { kind: "spider", pal: "shadow" },
  snake: { kind: "serpent", pal: "poisonGreen" },
  wolf: { kind: "wolf", pal: "furGray" },
  skeleton: { kind: "skeleton", pal: "bone" },
  zombie: { kind: "zombie", pal: "poisonGreen" },
  imp: { kind: "demon", pal: "demonRed" },
  boar: { kind: "boar", pal: "beastBrown" },
  orc: { kind: "goblinoid", pal: "oliveGreen" },
  ghost: { kind: "ghost", pal: "ghostPale" },
  mushroom: { kind: "mushroom", pal: "redCap" },
  scorpion: { kind: "scorpion", pal: "beastBrown" },
  crab: { kind: "crab", pal: "bloodRed" },
  bee: { kind: "bee", pal: "gold" },
  mummy: { kind: "mummy", pal: "bone" },
  cyclops: { kind: "giant", pal: "beastBrown", opt: "one" },
  harpy: { kind: "harpy", pal: "beastBrown" },
  lizardman: { kind: "lizard", pal: "slimeGreen" },
  gargoyle: { kind: "gargoyle", pal: "rockGray" },
  wraith: { kind: "ghost", pal: "shadow" },
  werewolf: { kind: "wolf", pal: "shadow" },
  vampire: { kind: "vampire", pal: "shadow" },
  golem: { kind: "golem", pal: "rockGray" },
  troll: { kind: "giant", pal: "goblinGreen" },
  minotaur: { kind: "minotaur", pal: "beastBrown" },
  wisp: { kind: "wisp", pal: "iceBlue" },
  slimeking: { kind: "slime", pal: "slimeTeal", opt: "crown" },
  banshee: { kind: "ghost", pal: "ghostPale" },
  chimera: { kind: "beast", pal: "beastBrown", opt: "multi" },
  basilisk: { kind: "serpent", pal: "poisonGreen" },
  wyvern: { kind: "dragon", pal: "oliveGreen" },
  ogremage: { kind: "robed", pal: "demonPurple" },
  darkknight: { kind: "knight", pal: "shadow" },
  lich: { kind: "robed", pal: "ghostPale", opt: "skull" },
  behemoth: { kind: "giant", pal: "beastBrown" },
  kraken: { kind: "tentacle", pal: "aqua" },
  phoenix: { kind: "bird", pal: "fireOrange" },
  cerberus: { kind: "wolf", pal: "shadow", opt: "multi" },
  manticore: { kind: "beast", pal: "bloodRed" },
  djinn: { kind: "wisp", pal: "arcanePurple" },
  hydra: { kind: "dragon", pal: "poisonGreen", opt: "multi" },
  titan: { kind: "giant", pal: "rockGray" },
  specter: { kind: "ghost", pal: "shadow" },
  nightmare: { kind: "demon", pal: "shadow" },
  seraph: { kind: "angel", pal: "gold" },
  leviathan: { kind: "tentacle", pal: "aqua" },
  voidlord: { kind: "robed", pal: "shadow", opt: "void" },
  // bosses
  boss_ogre: { kind: "giant", pal: "demonRed" },
  boss_dragon: { kind: "dragon", pal: "demonRed" },
  boss_lich: { kind: "robed", pal: "ghostPale", opt: "skull" },
  boss_golem: { kind: "golem", pal: "rockGray" },
  boss_demon: { kind: "demon", pal: "demonPurple" },
  boss_leviathan: { kind: "tentacle", pal: "aqua" },
};

function eyes(g: Grid, x0: number, x1: number, y: number, c: string) {
  set(g, x0, y, c);
  set(g, x1, y, c);
}

// eslint-disable-next-line complexity
function drawCreature(g: Grid, kind: CreatureKind, p: CreaturePalette, opt?: CreatureOpt) {
  const { body, shade, eye } = p;
  switch (kind) {
    case "slime": {
      disc(g, 8, 10, 5, body);
      rect(g, 3, 13, 13, 13, shade);
      set(g, 6, 8, "#ffffff"); // shine
      eyes(g, 6, 10, 10, eye);
      hline(g, 7, 9, 12, shade); // mouth
      break;
    }
    case "bat": {
      disc(g, 8, 8, 2, body);
      set(g, 6, 5, body); set(g, 10, 5, body); // ears
      hline(g, 1, 5, 7, body); hline(g, 11, 15, 7, body); // wings
      hline(g, 2, 5, 8, shade); hline(g, 10, 13, 8, shade);
      set(g, 1, 6, body); set(g, 14, 6, body);
      eyes(g, 7, 8, 8, eye);
      break;
    }
    case "rodent": {
      disc(g, 7, 10, 3, body); // body
      disc(g, 11, 9, 2, body); // head
      set(g, 10, 6, body); set(g, 12, 6, body); // ears
      set(g, 13, 9, eye);
      set(g, 13, 10, shade); // snout
      set(g, 4, 11, shade); set(g, 3, 10, shade); set(g, 2, 10, shade); set(g, 1, 9, shade); // tail
      set(g, 6, 13, shade); set(g, 9, 13, shade);
      break;
    }
    case "goblinoid": {
      disc(g, 8, 6, 3, body); // head
      set(g, 3, 5, body); set(g, 4, 5, body); // ears
      set(g, 12, 5, body); set(g, 13, 5, body);
      eyes(g, 7, 9, 6, eye);
      set(g, 8, 8, shade); // nose
      set(g, 7, 9, FANG); set(g, 9, 9, FANG); // tusks
      rect(g, 6, 9, 10, 12, body); // torso
      set(g, 5, 10, shade); set(g, 11, 10, shade); // arms
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "spider": {
      disc(g, 8, 10, 3, body);
      disc(g, 8, 6, 1, body);
      eyes(g, 7, 9, 6, eye);
      for (let i = 0; i < 3; i++) {
        const y = 8 + i * 2;
        set(g, 4, y, shade); set(g, 3, y + 1, shade);
        set(g, 12, y, shade); set(g, 13, y + 1, shade);
      }
      break;
    }
    case "serpent": {
      const path: [number, number][] = [
        [8, 14], [8, 13], [7, 12], [6, 11], [6, 10], [7, 9], [8, 8], [9, 7], [9, 6],
      ];
      for (const [x, y] of path) { set(g, x, y, body); set(g, x + 1, y, shade); }
      disc(g, 8, 4, 2, body); // head
      eyes(g, 7, 9, 4, eye);
      set(g, 8, 2, "#ef4444"); set(g, 8, 1, "#ef4444"); // tongue
      break;
    }
    case "wolf": {
      rect(g, 4, 8, 11, 11, body);
      disc(g, 4, 7, 2, body); // head left
      set(g, 2, 5, body); set(g, 3, 5, body); // ear
      set(g, 3, 7, eye);
      set(g, 1, 8, shade); // snout
      set(g, 12, 7, body); set(g, 13, 6, body); // tail
      vline(g, 5, 12, 14, shade); vline(g, 8, 12, 13, shade); vline(g, 10, 12, 14, shade);
      if (opt === "multi") { disc(g, 9, 6, 1, body); set(g, 10, 6, eye); } // extra head
      break;
    }
    case "skeleton": {
      disc(g, 8, 6, 3, body); // skull
      set(g, 6, 6, shade); set(g, 10, 6, shade); // sockets
      set(g, 8, 8, shade);
      hline(g, 6, 10, 9, body); // jaw
      vline(g, 8, 10, 14, body); // spine
      hline(g, 6, 10, 11, body); hline(g, 6, 10, 13, body); // ribs
      break;
    }
    case "zombie": {
      disc(g, 8, 5, 2, body);
      set(g, 7, 5, eye); set(g, 9, 5, shade); // uneven eyes
      rect(g, 6, 7, 10, 12, body);
      set(g, 5, 8, body); set(g, 4, 8, body); set(g, 3, 8, shade); // arm out
      set(g, 8, 9, shade); // stitch
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "demon": {
      disc(g, 8, 6, 2, body);
      set(g, 5, 4, body); set(g, 5, 3, shade); // horns
      set(g, 11, 4, body); set(g, 11, 3, shade);
      eyes(g, 7, 9, 6, eye);
      rect(g, 6, 8, 10, 11, body);
      set(g, 4, 7, shade); set(g, 3, 8, shade); // wings
      set(g, 12, 7, shade); set(g, 13, 8, shade);
      set(g, 11, 12, shade); set(g, 12, 13, shade); // tail
      vline(g, 6, 12, 13, shade); vline(g, 10, 12, 13, shade);
      break;
    }
    case "boar": {
      rect(g, 4, 9, 12, 11, body);
      disc(g, 8, 9, 3, body);
      disc(g, 4, 9, 2, body); // snout head
      set(g, 2, 9, shade);
      set(g, 2, 10, FANG); // tusk
      set(g, 4, 8, eye);
      set(g, 7, 5, shade); set(g, 8, 4, shade); set(g, 9, 5, shade); // bristles
      vline(g, 6, 12, 14, shade); vline(g, 10, 12, 14, shade);
      break;
    }
    case "ghost": {
      disc(g, 8, 7, 4, body);
      rect(g, 4, 7, 12, 12, body);
      for (const x of [4, 6, 8, 10, 12]) set(g, x, 13, body); // wavy hem
      eyes(g, 6, 10, 7, eye);
      set(g, 8, 9, eye); // mouth
      break;
    }
    case "mushroom": {
      disc(g, 8, 6, 4, body);
      rect(g, 4, 6, 12, 7, body); // cap
      set(g, 6, 5, "#fff7ed"); set(g, 10, 6, "#fff7ed"); set(g, 8, 4, "#fff7ed"); // spots
      rect(g, 7, 8, 9, 13, "#f5e6c8"); // stem
      eyes(g, 7, 9, 10, shade); // little eyes on stem
      break;
    }
    case "scorpion": {
      disc(g, 7, 10, 3, body);
      set(g, 4, 8, body); set(g, 3, 9, body); set(g, 2, 8, shade); // left claw
      set(g, 4, 12, body); set(g, 3, 12, shade);
      set(g, 10, 9, body); set(g, 11, 8, body); set(g, 12, 7, body); set(g, 12, 6, body); set(g, 11, 5, body); // tail
      set(g, 11, 4, "#ef4444"); // stinger
      set(g, 5, 13, shade); set(g, 7, 13, shade); set(g, 9, 13, shade); // legs
      eyes(g, 6, 8, 9, eye);
      break;
    }
    case "crab": {
      disc(g, 8, 9, 4, body);
      rect(g, 4, 9, 12, 11, body);
      vline(g, 6, 5, 7, shade); set(g, 6, 5, eye); // eyestalks
      vline(g, 10, 5, 7, shade); set(g, 10, 5, eye);
      set(g, 2, 9, body); set(g, 1, 9, body); set(g, 1, 8, shade); // claws
      set(g, 14, 9, body); set(g, 15, 9, body); set(g, 15, 8, shade);
      set(g, 4, 12, shade); set(g, 6, 12, shade); set(g, 10, 12, shade); set(g, 12, 12, shade); // legs
      break;
    }
    case "bee": {
      disc(g, 8, 9, 3, body);
      hline(g, 6, 10, 8, shade); hline(g, 6, 10, 10, shade); // stripes
      disc(g, 8, 5, 1, shade); // head
      set(g, 5, 6, "#e0f2fe"); set(g, 6, 6, "#e0f2fe"); // wings
      set(g, 10, 6, "#e0f2fe"); set(g, 11, 6, "#e0f2fe");
      set(g, 8, 13, shade); // stinger
      eyes(g, 7, 5, 5, eye);
      break;
    }
    case "mummy": {
      disc(g, 8, 5, 2, body);
      rect(g, 6, 7, 10, 13, body);
      set(g, 8, 5, shade); // single eye glint
      hline(g, 6, 10, 8, shade); hline(g, 6, 10, 11, shade); set(g, 7, 12, shade); set(g, 9, 10, shade); // bandages
      set(g, 5, 8, body); set(g, 4, 8, body); set(g, 11, 8, body); set(g, 12, 8, body); // arms out
      break;
    }
    case "giant": {
      disc(g, 8, 5, 3, body); // big head
      if (opt === "one") { disc(g, 8, 5, 1, eye); set(g, 8, 5, shade); }
      else eyes(g, 7, 9, 5, eye);
      rect(g, 5, 8, 11, 13, body); // torso
      vline(g, 4, 9, 12, shade); vline(g, 12, 9, 12, shade); // arms
      vline(g, 6, 14, 15, shade); vline(g, 10, 14, 15, shade); // legs
      break;
    }
    case "harpy": {
      disc(g, 8, 5, 2, body);
      eyes(g, 7, 9, 5, eye);
      rect(g, 7, 7, 9, 11, body); // slim torso
      for (let i = 0; i < 4; i++) { set(g, 6 - i, 7 + i, shade); set(g, 10 + i, 7 + i, shade); } // wings
      set(g, 7, 12, "#fbbf24"); set(g, 9, 12, "#fbbf24"); // talons
      break;
    }
    case "lizard": {
      disc(g, 7, 5, 2, body);
      set(g, 9, 5, shade); set(g, 10, 5, shade); // snout
      set(g, 6, 5, eye);
      set(g, 8, 3, shade); set(g, 7, 4, shade); // crest
      rect(g, 6, 7, 9, 11, body); // torso
      set(g, 10, 11, body); set(g, 11, 12, body); set(g, 12, 12, shade); set(g, 13, 13, shade); // tail
      vline(g, 6, 12, 14, shade); vline(g, 9, 12, 14, shade);
      break;
    }
    case "gargoyle": {
      disc(g, 8, 6, 2, body);
      set(g, 6, 4, shade); set(g, 10, 4, shade); // horns
      eyes(g, 7, 9, 6, eye);
      rect(g, 6, 8, 10, 11, body);
      set(g, 4, 7, shade); set(g, 3, 7, shade); set(g, 3, 8, shade); // stone wings
      set(g, 11, 7, shade); set(g, 12, 7, shade); set(g, 12, 8, shade);
      vline(g, 6, 12, 13, shade); vline(g, 10, 12, 13, shade);
      break;
    }
    case "vampire": {
      disc(g, 8, 5, 2, "#e5e7eb"); // pale face
      set(g, 7, 5, eye); set(g, 9, 5, eye);
      set(g, 7, 7, FANG); set(g, 9, 7, FANG); // fangs
      set(g, 5, 6, "#b91c1c"); set(g, 11, 6, "#b91c1c"); // collar
      rect(g, 6, 7, 10, 13, body);
      set(g, 4, 8, shade); set(g, 3, 9, shade); set(g, 12, 8, shade); set(g, 13, 9, shade); // cape
      break;
    }
    case "golem": {
      rect(g, 4, 4, 11, 13, body);
      set(g, 3, 5, shade); set(g, 12, 5, shade); // shoulders
      eyes(g, 6, 9, 7, eye); // glowing eyes
      set(g, 8, 6, shade); set(g, 8, 7, shade); set(g, 7, 10, shade); set(g, 9, 11, shade); // cracks
      rect(g, 5, 14, 6, 15, shade); rect(g, 9, 14, 10, 15, shade);
      break;
    }
    case "minotaur": {
      disc(g, 8, 5, 3, body);
      set(g, 3, 4, BONE); set(g, 4, 4, BONE); set(g, 12, 4, BONE); set(g, 13, 4, BONE); // horns
      eyes(g, 7, 9, 5, eye);
      set(g, 8, 7, shade); // snout
      rect(g, 5, 8, 11, 12, body);
      vline(g, 4, 9, 11, shade); vline(g, 12, 9, 11, shade);
      vline(g, 6, 13, 14, shade); vline(g, 10, 13, 14, shade);
      break;
    }
    case "wisp": {
      disc(g, 8, 7, 3, body);
      ring(g, 8, 7, 4, shade);
      set(g, 8, 7, "#ffffff"); // bright core
      set(g, 8, 12, body); set(g, 7, 13, shade); set(g, 9, 11, body); set(g, 6, 11, shade); set(g, 11, 9, body); // sparks
      break;
    }
    case "knight": {
      rect(g, 6, 3, 10, 7, body); // helmet
      hline(g, 6, 10, 5, eye); // visor glow
      set(g, 8, 2, "#ef4444"); // plume
      rect(g, 5, 8, 10, 13, body); // armour
      vline(g, 12, 3, 9, BONE); set(g, 12, 10, shade); hline(g, 11, 13, 10, shade); // sword
      vline(g, 6, 14, 15, shade); vline(g, 9, 14, 15, shade);
      break;
    }
    case "robed": {
      disc(g, 8, 5, 3, body); // hood
      const face = opt === "skull" ? "#e5e7eb" : shade;
      set(g, 8, 5, face);
      set(g, 7, 6, eye); set(g, 9, 6, eye); // eyes in hood
      if (opt === "skull") { set(g, 8, 7, "#9ca3af"); }
      for (let y = 8; y <= 14; y++) hline(g, 8 - (y - 7), 8 + (y - 7), y, body); // robe
      vline(g, 13, 3, 14, "#a16207"); // staff
      const orb = opt === "void" ? "#000000" : eye;
      disc(g, 13, 3, 1, orb);
      if (opt === "void") ring(g, 13, 3, 1, "#a855f7");
      break;
    }
    case "tentacle": {
      disc(g, 8, 6, 4, body); // mantle
      eyes(g, 6, 10, 6, eye);
      for (const x of [4, 6, 8, 10, 12]) { vline(g, x, 10, 13, body); set(g, x, 14, shade); } // tentacles
      set(g, 3, 13, shade); set(g, 13, 13, shade);
      break;
    }
    case "dragon": {
      disc(g, 6, 10, 3, body); // body
      set(g, 8, 8, body); set(g, 9, 7, body); set(g, 10, 6, body); // neck
      disc(g, 12, 5, 2, body); set(g, 14, 5, shade); // head + snout
      set(g, 11, 5, eye);
      set(g, 4, 6, shade); set(g, 3, 5, shade); set(g, 5, 7, shade); set(g, 2, 6, shade); // wing
      set(g, 3, 12, body); set(g, 2, 13, shade); // tail
      set(g, 5, 13, shade); set(g, 8, 13, shade); // legs
      if (opt === "multi") { set(g, 9, 9, body); set(g, 10, 9, body); disc(g, 11, 9, 1, body); set(g, 12, 9, eye); } // 2nd head
      break;
    }
    case "bird": {
      disc(g, 8, 7, 2, body);
      set(g, 8, 4, body); set(g, 8, 3, shade); // crest
      set(g, 9, 5, "#1f2937"); set(g, 10, 6, "#fbbf24"); // eye + beak
      set(g, 6, 7, body); set(g, 5, 6, body); set(g, 4, 5, shade); // left wing
      set(g, 10, 7, body); set(g, 11, 6, body); set(g, 12, 5, shade); // right wing
      set(g, 7, 10, body); set(g, 9, 10, body); set(g, 8, 11, shade); set(g, 8, 12, body); // tail
      break;
    }
    case "angel": {
      ring(g, 8, 2, 1, "#fbbf24"); // halo
      disc(g, 8, 5, 2, body);
      set(g, 7, 5, shade); set(g, 9, 5, shade);
      rect(g, 7, 7, 9, 12, body); // robe
      set(g, 5, 7, BONE); set(g, 4, 7, BONE); set(g, 4, 8, BONE); set(g, 3, 8, BONE); // wings
      set(g, 11, 7, BONE); set(g, 12, 7, BONE); set(g, 12, 8, BONE); set(g, 13, 8, BONE);
      break;
    }
    case "beast": {
      rect(g, 4, 8, 11, 11, body);
      ring(g, 11, 7, 2, shade); disc(g, 11, 7, 1, body); // maned head right
      set(g, 12, 7, eye);
      set(g, 3, 8, body); set(g, 2, 7, shade); // tail tuft
      vline(g, 5, 12, 14, shade); vline(g, 10, 12, 14, shade);
      if (opt === "multi") { disc(g, 5, 6, 1, body); set(g, 5, 6, eye); } // extra head
      break;
    }
  }
}

function buildEnemyGrid(spec: EnemyIconSpec): Grid {
  const g = blank();
  const art = ENEMY_ART[spec.templateId] ?? { kind: "beast", pal: "furGray" };
  drawCreature(g, art.kind, CP[art.pal], art.opt);
  // Bosses wear a small golden crown.
  if (spec.isBoss || art.opt === "crown") {
    const gold = "#fbbf24";
    set(g, 5, 1, gold); set(g, 8, 0, gold); set(g, 11, 1, gold);
    hline(g, 5, 11, 2, gold);
  }
  // ★ aura: a sparse glow ring for modified enemies.
  if (spec.modTier > 0) {
    const glow = spec.modTier >= 3 ? "#f59e0b" : spec.modTier === 2 ? "#a855f7" : "#38bdf8";
    for (const [x, y] of [[1, 4], [14, 4], [2, 12], [13, 12], [8, 1]] as const) set(g, x, y, glow);
  }
  return g;
}

// ----- Rendering + cache -----
// Bounded LRU: distinct item/enemy icons accumulate over a long run; without a
// cap the cache (base64 PNGs) grows unbounded across hundreds of floors (#perf).
const cache = new Map<string, string>();
const ICON_CACHE_MAX = 400;

function cachePut(key: string, url: string): string {
  cache.set(key, url);
  if (cache.size > ICON_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return url;
}

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
  return cachePut(key, gridToDataUrl(buildEnemyGrid(spec)));
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
  return cachePut(key, gridToDataUrl(buildGrid(spec)));
}

// ===== Slot reel symbols (dedicated pixel art) =====
// The slot uses its own 16×16 sprites instead of text: 7 (BIG), BAR (REG),
// リプレイ, ベル, スイカ, チェリー, and plain dice digits for ハズレ目.

const SLOT_FONT: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};
function drawDigit(g: Grid, ch: string, color: string, ox = 5, oy = 3) {
  const f = SLOT_FONT[ch];
  if (!f) return;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 3; c++)
      if (f[r][c] === "1") {
        const x = ox + c * 2;
        const y = oy + r * 2;
        set(g, x, y, color);
        set(g, x + 1, y, color);
        set(g, x, y + 1, color);
        set(g, x + 1, y + 1, color);
      }
}

function buildSlotGrid(value: number): Grid {
  const g = blank();
  switch (value) {
    case 7: {
      drawDigit(g, "7", "#7f1d1d", 6, 4); // shadow
      drawDigit(g, "7", "#f87171"); // bright red 7
      break;
    }
    case 4: {
      const gold = "#fbbf24";
      const dk = "#b45309";
      const hi = "#fde68a";
      rect(g, 3, 6, 12, 10, gold);
      hline(g, 3, 12, 6, hi);
      hline(g, 3, 12, 10, dk);
      vline(g, 3, 6, 10, dk);
      vline(g, 12, 6, 10, dk);
      break;
    }
    case 1: {
      const c = "#22d3ee";
      ring(g, 8, 8, 5, c);
      set(g, 13, 5, c);
      set(g, 14, 5, c);
      set(g, 13, 4, c);
      set(g, 12, 5, c);
      break;
    }
    case 2: {
      const y = "#fde047";
      const d = "#ca8a04";
      set(g, 8, 3, y);
      hline(g, 7, 9, 4, y);
      hline(g, 7, 9, 5, y);
      hline(g, 6, 10, 6, y);
      hline(g, 6, 10, 7, y);
      hline(g, 5, 11, 8, y);
      hline(g, 5, 11, 9, y);
      hline(g, 5, 11, 10, d);
      set(g, 8, 11, d);
      set(g, 8, 12, d);
      break;
    }
    case 5: {
      const grn = "#16a34a";
      const grnD = "#14532d";
      const red = "#ef4444";
      const seed = "#1f2937";
      disc(g, 8, 8, 6, grn);
      disc(g, 8, 9, 5, red);
      ring(g, 8, 8, 6, grnD);
      set(g, 6, 8, seed);
      set(g, 9, 7, seed);
      set(g, 10, 10, seed);
      set(g, 7, 11, seed);
      break;
    }
    case 9: {
      const red = "#ef4444";
      const hi = "#fca5a5";
      const grn = "#22c55e";
      disc(g, 6, 11, 2, red);
      disc(g, 11, 11, 2, red);
      set(g, 5, 10, hi);
      set(g, 10, 10, hi);
      set(g, 7, 8, grn);
      set(g, 8, 7, grn);
      set(g, 8, 6, grn);
      set(g, 8, 5, grn);
      set(g, 8, 4, grn);
      set(g, 9, 7, grn);
      set(g, 10, 8, grn);
      set(g, 11, 9, grn);
      break;
    }
    default:
      drawDigit(g, String(value), "#9ca3af");
  }
  return g;
}

/** Pixel-art sprite for a slot reel symbol (dice face / role 1–9). */
export function getSlotIconDataUrl(value: number): string {
  const key = "slot|" + value;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  return cachePut(key, gridToDataUrl(buildSlotGrid(value)));
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
