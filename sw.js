/* QR Site service worker — offline shell + share target */
const CACHE = 'qrsite-v5';
const SHARE_CACHE = 'qrsite-share-target';

/* Paths are relative to the worker's scope, so the app works from a subpath too. */
const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'lib-core.js',
  'lib-csv.js',
  'app.js',
  'scan.js',
  'batch.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/qrcode.min.js',
  'vendor/jsQR.js',
  'vendor/jszip.min.js',
  'vendor/zxing.min.js'
];

/* Do not call skipWaiting() on install: the page shows an update banner and
 * asks the user to reload. That keeps upgrades from swapping code under a
 * running session. */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== SHARE_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Share target: stash the uploaded image, then redirect into the app.
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) {
    event.respondWith((async () => {
      const form = await req.formData();
      const file = form.get('image');
      const cache = await caches.open(SHARE_CACHE);
      if (file && file instanceof File) {
        const key = new URL('shared-image', self.registration.scope).href;
        await cache.put(key, new Response(file));
      }
      return Response.redirect('./?share-target=1', 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // Never cache the share cache endpoint.
  if (url.pathname.endsWith('/shared-image')) return;

  // Network-first for navigation, cache-first for assets.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put('index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(CACHE);
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && url.origin === location.origin) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (e) {
      return hit || Response.error();
    }
  })());
});
