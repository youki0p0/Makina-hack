// ===== Slot reel symbols (dedicated pixel art) =====
// The slot uses its own 16×16 sprites instead of text: 7 (BIG), BAR (REG),
// リプレイ, ベル, スイカ, チェリー, and plain dice digits for ハズレ目.

import { blank, disc, hline, rect, ring, set, vline, type Grid } from "./grid";
import { renderToCache } from "./cache";

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
  return renderToCache("slot|" + value, () => buildSlotGrid(value));
}
