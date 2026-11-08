const CACHE = 'daily-life-os-v2';

// Daftar ini harus persis sesuai nama file yang ada di folder aplikasi.
// Jika ada satu file yang tidak ditemukan, service worker gagal dipasang sama sekali.
const CORE = [
  './',
  './index.html',
  './app.js',
  './schedule.json',
  './firebase-config.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first: ambil data terbaru dari internet dulu. Jika offline, pakai cache.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(e.request).then(response => response || caches.match('./index.html')))
  );
});
