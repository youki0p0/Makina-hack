// Offline-capable service worker.
//
// IMPORTANT: HTML navigations are NETWORK-FIRST. A previous version served the
// HTML shell with `cached || network`, so after a deploy the stale shell kept
// referencing old (hashed) JS chunks that no longer exist — the app failed to
// load ("重くてロードできない"). Network-first keeps the shell in sync with the
// current chunks; immutable hashed assets stay cache-first for speed/offline.
const CACHE = "dice-dungeon-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop the old (poisoned) caches so a stale shell can't be served.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML documents: always try the network first so the app shell matches the
  // latest deploy's chunks; fall back to cache only when offline.
  const isDoc =
    req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isDoc) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(async () => (await caches.match(req)) || caches.match("/")),
    );
    return;
  }

  // Other same-origin GETs (hashed, immutable assets): cache-first + fill.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.status === 200 && res.type === "basic") cache.put(req, res.clone());
      return res;
    }),
  );
});
