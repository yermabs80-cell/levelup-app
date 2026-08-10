const CACHE = 'ethos-v11';

const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon.svg',
  './firebase-config.js',
  './src/main.js',
  './src/core/constants.js',
  './src/core/schema.js',
  './src/core/progress.js',
  './src/core/merge.js',
  './src/core/focus.js',
  './src/data/storage.js',
  './src/data/photos.js',
  './src/data/store.js',
  './src/data/cloud.js',
  './src/data/ambient.js',
  './src/data/library.js',
  './src/ui/dom.js',
  './src/ui/html.js',
  './src/ui/feedback.js',
  './src/ui/render.js',
  './src/ui/account.js',
  './src/ui/modals.js',
  './src/ui/focus.js',
  './src/ui/photos.js'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  // Один недоступный файл не должен ронять установку целиком.
  event.waitUntil(
    caches.open(CACHE).then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url))))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => caches.match(request));
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Сторонние запросы идут в сеть напрямую: ответы Firebase Auth и Firestore
  // кэшировать нельзя — иначе можно отдать чужую или протухшую сессию.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(networkFirst(request));
});
