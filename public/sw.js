// Both values are stamped in by the build (see swManifest in vite.config.ts),
// so every deploy ships a byte-different worker and the browser picks it up.
const BUILD = '__BUILD_ID__';
const PRECACHE_ASSETS = /*__PRECACHE__*/[];

// Cache Storage is per-origin, and every project page on <user>.github.io
// shares one origin — so only ever touch caches carrying our own prefix.
const PREFIX = 'notation-quest-';
const CACHE = PREFIX + BUILD;
const SHELL = ['./', './index.html', './manifest.webmanifest'];
// resolved against this worker's URL, so it works under a subpath (/notalearn/assets/)
const ASSETS_PATH = new URL('./assets/', self.location).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // bypass the HTTP cache so the shell matches the assets precached alongside it
      .then((cache) => cache.addAll([...SHELL.map((url) => new Request(url, { cache: 'reload' })), ...PRECACHE_ASSETS]))
      // take over right away: pages load network-first, and main.ts offers a
      // reload to any open tab that is running an older build
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'GET_BUILD') event.ports[0]?.postMessage(BUILD);
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // drops the previous build's cache, hashed assets and all
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          // don't let a 404/5xx page replace the cached app shell
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put('./', copy));
          }
          return res;
        })
        .catch(() => caches.match('./', { cacheName: CACHE }))
    );
    return;
  }

  if (new URL(request.url).pathname.startsWith(ASSETS_PATH)) {
    event.respondWith(
      caches.match(request, { cacheName: CACHE }).then((cached) => cached || fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      }))
    );
    return;
  }

  event.respondWith(caches.match(request, { cacheName: CACHE }).then((cached) => cached || fetch(request)));
});
