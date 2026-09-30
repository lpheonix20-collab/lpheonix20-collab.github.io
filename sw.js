/* Phoenix service worker: caches the app shell so the journal opens offline.
   Supabase API/Realtime and TradingView are never cached (always live). */
var VERSION = 'phoenix-v4.0.1';
var SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.min.js';
var SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(SHELL).then(function () {
      return fetch(SB_JS, { mode: 'cors' }).then(function (r) { if (r.ok) return c.put(SB_JS, r); }).catch(function () {});
    });
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  // The page itself: network first (so updates arrive), cached copy when offline.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) {
      if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put('./index.html', copy); }); }
      return r;
    }).catch(function () {
      return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
    }));
    return;
  }
  // Same-origin static files + the pinned supabase-js build: cache first, refresh in the background.
  if (url.origin === self.location.origin || req.url === SB_JS) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r.ok) { var copy = r.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); }
        return r;
      });
      if (hit) { net.catch(function () {}); return hit; }
      return net;
    }));
  }
});
