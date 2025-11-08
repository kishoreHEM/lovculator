const CACHE_NAME = 'lovculator-v1.3.0';
const API_CACHE_NAME = 'lovculator-api-v1.3.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/about.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/record.html',
  '/love-stories.html',
  '/css/style.css',
  '/js/app.js',
  '/js/navigation.js',
  '/js/simple-stats.js',
  '/js/social-share.js',
  '/js/init.js',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// INSTALL
self.addEventListener('install', event => {
  console.log('🔄 Installing Service Worker', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch(err => console.error('❌ Caching failed:', err))
  );
});

// ACTIVATE
self.addEventListener('activate', event => {
  console.log('🚀 Activating Service Worker...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log('🗑️ Removing old cache:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// FETCH HANDLER
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET or cross-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Network-first for HTML pages
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then(response => response)
        .catch(() => caches.match(request, { ignoreSearch: true })
          .then(res => res || caches.match('/offline.html')))

    );
    return;
  }

  // Cache-first for static assets
  if (['style', 'script', 'image'].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then(cached => {
        const networkFetch = fetch(request)
          .then(networkRes => {
            if (networkRes.status === 200) {
              const clone = networkRes.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return networkRes;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network-first for API
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(API_CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Default
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(res => res || fetch(request))
  );
});

// MESSAGE HANDLER
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n))));
  }
});

// PUSH NOTIFICATIONS
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lovculator ❤️', {
      body: data.body || 'New update available!',
      icon: '/images/icon-192x192.png',
      badge: '/images/icon-192x192.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientsArr => {
      const client = clientsArr.find(c => c.url === '/' && 'focus' in c);
      if (client) return client.focus();
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
