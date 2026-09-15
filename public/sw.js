/*
 * Deliberately minimal.
 *
 * A service worker with a fetch handler is required before a browser will
 * offer "Install". This one caches NOTHING and passes every request straight
 * to the network — during a live round, a stale clue or a stale leaderboard
 * would be far worse than no offline support.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // clear anything a previous version may have cached
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
