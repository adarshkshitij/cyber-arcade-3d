// ==============================================================================
// ⚡ Cyber Arcade 3D - Service Worker (sw.js)
// Stale-While-Revalidate caching for instant offline arcade gameplay
// ==============================================================================

const CACHE_NAME = 'cyber-arcade-3d-v1.2.0';
const CORE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './racer-engine.js',
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback to cache if network fails
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
