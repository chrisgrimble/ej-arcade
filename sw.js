'use strict';
// Lets the installed arcade run offline. Network first, so a new version is
// picked up whenever the phone is online. Each game folder has its own service
// worker and cache, so this one only looks after the arcade's own files.
const CACHE = 'ej-arcade-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'fonts/press-start-2p.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];
const OWN = new Set(FILES.map(f => new URL(f, self.location).href));

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Cache storage is shared with the games on this origin, so only touch our own.
    .then(keys => Promise.all(keys.filter(k => k.startsWith('ej-arcade-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  url.search = '';
  if (e.request.method !== 'GET' || !OWN.has(url.href)) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
