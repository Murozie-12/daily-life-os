
const CACHE = 'daily-life-os-v3';
const CACHE_PREFIX = 'daily-life-os-';

const CORE = [
  './',
  './index.html',
  './app.js',
  './schedule.json',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

// Install: simpan aset utama aplikasi
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

// Activate: hapus hanya cache versi lama aplikasi
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key =>
              key.startsWith(CACHE_PREFIX) &&
              key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first dengan fallback offline
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Jangan tangani request lintas origin atau non-GET
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  // Jangan cache URL di luar cakupan aplikasi
  if (!url.pathname.startsWith(
    new URL(self.registration.scope).pathname
  )) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (
          response.ok &&
          response.type === 'basic' &&
          !url.pathname.endsWith('/sw.js')
        ) {
          const copy = response.clone();

          event.waitUntil(
            caches.open(CACHE)
              .then(cache => cache.put(request, copy))
          );
        }

        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);

        if (cached) return cached;

        // Fallback HTML hanya untuk halaman navigasi
        if (request.mode === 'navigate') {
          return (
            await caches.match('./index.html')
          ) || Response.error();
        }

        return Response.error();
      })
  );
});
