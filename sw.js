const CACHE = 'daily-life-os-v1';
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
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Menggunakan Strategi Network-First: 
// Selalu usahakan mengambil data terbaru dari internet. Jika offline, baru pakai cache.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  
  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Jika berhasil mengambil dari internet, perbarui cache secara otomatis
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Jika sedang offline (tidak ada internet), ambil dari cache
        return caches.match(e.request).then(response => response || caches.match('./index.html'));
      })
  );
});
