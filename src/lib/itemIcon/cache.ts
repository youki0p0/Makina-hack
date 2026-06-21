// ===== Rendered-icon cache =====
// Bounded LRU: distinct item/enemy icons accumulate over a long run; without a
// cap the cache (base64 PNGs) grows unbounded across hundreds of floors (#perf).
// The finite glyph set opts out of eviction (`cap: false`).

import { gridToDataUrl, type Grid } from "./grid";

const cache = new Map<string, string>();
const ICON_CACHE_MAX = 400;

/**
 * Return the cached data URL for `key`, or build → rasterize → cache it.
 * Returns "" during SSR (no canvas) without caching. When `cap` is true the
 * cache evicts its oldest entry once it exceeds {@link ICON_CACHE_MAX}.
 */
export function renderToCache(key: string, build: () => Grid, cap = true): string {
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (typeof document === "undefined") return "";
  const url = gridToDataUrl(build());
  cache.set(key, url);
  if (cap && cache.size > ICON_CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return url;
}
