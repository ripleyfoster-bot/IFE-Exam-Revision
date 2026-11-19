/* Offline cache. Change CACHE whenever any file changes, or phones keep the old copy. */
var CACHE = 'ife3-v0.9.2';
var FILES = ['./', 'index.html', 'styles.css', 'config.js', 'app.js', 'content/module1.js', 'content/module2.js', 'content/module3.js', 'content/revision.js',
  'manifest.webmanifest', 'bg.svg', 'icons/icon-180-v2.png', 'icons/icon-192-v2.png', 'icons/icon-512-v2.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) { return hit || fetch(e.request); }));
});
