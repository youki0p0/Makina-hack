// ===== UI glyphs (replace emoji with pixel art) =====
// Small procedural icons for stats, currencies, statuses and navigation, so the
// UI uses the same pixel-art language as items/enemies — no emoji.

import { blank, disc, hline, rect, ring, set, vline, type Grid } from "./grid";
import { renderToCache } from "./cache";

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
  return renderToCache("glyph|" + kind, () => {
    const g = blank();
    (GLYPHS[kind] ?? GLYPHS.star)(g);
    return g;
  }, false);
}
