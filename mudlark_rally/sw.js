'use strict';
// Lets the installed app run offline. The network is tried first so that a
// new version of the game is picked up whenever the phone is online.
const CACHE = 'mudlark-rally-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'js/audio.js', 'js/track.js', 'js/art.js', 'js/freerun.js', 'js/scores.js', 'js/main.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    // Cache storage is shared by every app on this origin, so only touch our own.
    .then(keys => Promise.all(keys.filter(k => k.startsWith('mudlark-rally-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(res => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
    }
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
