// ===== Procedural pixel-art icons =====
// NO image assets. Every icon is drawn from a seed on a 16×16 canvas and scaled
// up with nearest-neighbor. Same seed ⇒ same icon. Results are cached as base64.
//
// This barrel keeps the public API stable while the art lives in focused
// modules: grid primitives, the shared cache, and per-domain drawers
// (item / enemy / slot / glyph).

export { hashSeed } from "./rng";
export { getItemIconDataUrl, type IconSpec } from "./itemArt";
export { getEnemyIconDataUrl, type EnemyIconSpec } from "./enemyArt";
export { getSlotIconDataUrl } from "./slotArt";
export { getGlyphIconDataUrl, type GlyphKind } from "./glyphs";
