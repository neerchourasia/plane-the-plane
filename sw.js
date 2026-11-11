// Offline support: after the first visit, the game and admin page load without wifi.
// Bump CACHE when any shipped file changes so browsers pick up the new version.
const CACHE = 'plane-the-plane-v1';
const FILES = ['./', './index.html', './admin.html', './favicon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // Serve the cached copy at once, and refresh it in the background when wifi is there.
  event.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req)
        .then(res => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) return cached;
      const fresh = await network;
      if (fresh) return fresh;
      // Offline and never cached: fall back to the game page for page visits.
      if (req.mode === 'navigate') {
        const home = await cache.match('./index.html');
        if (home) return home;
      }
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    })
  );
});
