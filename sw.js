// ==============================================================================
// ⚡ Cyber Arcade 3D - Service Worker (sw.js)
// Stale-While-Revalidate caching for instant offline arcade gameplay
// ==============================================================================

const CACHE_NAME = 'cyber-arcade-3d-v1.3.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './racer-engine.js',
  './achievements.js',
  './game.js',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Look up the cache once and share the promise between the response we
  // serve and the network-failure fallback below.
  const cachedResponsePromise = caches.match(event.request);

  // Kick off revalidation immediately (before respondWith) and chain the
  // cache.put() write into the same promise, so event.waitUntil() below can
  // keep the worker alive until the cache update has actually completed -
  // not just until the network response headers arrive.
  const fetchPromise = fetch(event.request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        const responseClone = networkResponse.clone();
        return caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseClone))
          .then(() => networkResponse);
      }
      return networkResponse;
    })
    .catch(() => {
      // Network failed: fall back to whatever was cached (may be undefined).
      return cachedResponsePromise;
    });

  event.waitUntil(fetchPromise);

  event.respondWith(
    cachedResponsePromise.then((cachedResponse) => cachedResponse || fetchPromise)
  );
});
