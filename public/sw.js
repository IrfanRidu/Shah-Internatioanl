const CACHE_NAME = 'shah-intl-v2';
const STATIC_ASSETS = ['/', '/products', '/categories', '/about', '/contact'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.url.includes('/api/')) return;
  // Network-first, cache only as an offline fallback — was cache-first with a background refresh
  // (`return cached || networkFetch`), which handed back whatever was cached immediately and only
  // updated the cache for NEXT time. That's the wrong tradeoff for this site: '/' and '/products'
  // are in STATIC_ASSETS below and pre-cached on install, but both are Server Components rendering
  // live DB data (prices, active campaigns, stock) on every real request — an online visitor could
  // get served yesterday's homepage from cache while every actual page load elsewhere on the site
  // was already showing today's data, with no way to tell the two apart. Network-first means an
  // online visitor always gets a genuinely fresh render; the cache now only ever serves when the
  // network request itself fails (actually offline), which is the one case a cache should apply to.
  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'Shah International', {
      body: data.body || 'You have a new notification',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
