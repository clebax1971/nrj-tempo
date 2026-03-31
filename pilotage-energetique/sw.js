const CACHE = 'edf-tempo-v7';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './js/app.js',
  './js/state.js',
  './js/engine.js',
  './js/tempo-cal.js',
  './js/ui.js',
  './js/csv.js',
  './js/views/dashboard.js',
  './js/views/saisie.js',
  './js/views/periode.js',
  './js/views/echeancier.js',
  './js/views/archives.js',
  './js/views/config.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(ASSETS.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
