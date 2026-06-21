// ===== Shared 16×16 pixel grid + drawing primitives =====
// Every procedural icon is drawn on a 16×16 canvas of nullable colors and then
// scaled up with nearest-neighbor. These primitives are shared by item, enemy,
// slot and glyph art so the whole UI speaks the same pixel-art language.

export const SIZE = 16;

export type Grid = (string | null)[][];

export function blank(): Grid {
  return Array.from({ length: SIZE }, () => Array<string | null>(SIZE).fill(null));
}
export function set(g: Grid, x: number, y: number, c: string | null) {
  if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) g[y][x] = c;
}
export function vline(g: Grid, x: number, y0: number, y1: number, c: string) {
  for (let y = y0; y <= y1; y++) set(g, x, y, c);
}
export function hline(g: Grid, x0: number, x1: number, y: number, c: string) {
  for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
export function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: string | null) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(g, x, y, c);
}
export function disc(g: Grid, cx: number, cy: number, r: number, c: string | null) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) set(g, cx + x, cy + y, c);
}
export function ring(g: Grid, cx: number, cy: number, r: number, c: string | null) {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d <= r * r && d >= (r - 1) * (r - 1)) set(g, cx + x, cy + y, c);
    }
}

/** Rasterize a 16×16 grid to a base64 PNG data URL. Returns "" during SSR. */
export function gridToDataUrl(grid: Grid): string {
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
