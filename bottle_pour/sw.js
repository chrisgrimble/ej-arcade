// Service worker: lets the game be installed as an app and played offline.
//
// Network first: when online you always get the latest version (and the saved
// copy is refreshed); when offline the saved copy is used. Bump CACHE when the
// list of files changes.

const CACHE = "bottle-pour-v2";
const FILES = [
  "./",
  "index.html",
  "rules.js",
  "progress.js",
  "transfer.js",
  "levels.js",
  "sound.js",
  "celebrate.js",
  "game.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  self.skipWaiting();
});

// Remove copies saved by older versions of this file. Other games in the
// arcade share this origin's cache storage, so only touch our own.
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => key.startsWith("bottle-pour-") && key !== CACHE)
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== location.origin) return;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then(saved => saved || caches.match("index.html"))),
  );
});
