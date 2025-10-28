const CACHE_NAME = 'lovculator-v1.1.0';
const urlsToCache = [
  '/',
  '/love-calculator-by-name.html',
  '/about.html',
  '/contact.html',
  '/privacy.html',
  '/terms.html',
  '/css/style.css',
  '/js/app.js',
  '/js/navigation.js',
  '/js/love-stories.js',
  '/js/social-share.js',
  '/js/achievements.js',
  '/js/couple-of-week.js',
  '/js/challenges.js',
  '/js/init.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.log('Cache installation failed:', error);
            })
    );
    // Activate worker immediately
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Take control of all clients
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip browser extensions and external resources
    if (event.request.url.includes('chrome-extension') || 
        event.request.url.includes('sockjs') ||
        event.request.url.includes('hot-update')) {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version if found
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(response => {
                        // Check if we received a valid response
                        if (!response || response.status !== 200 || response.type === 'opaque') {
                            return response;
                        }

                        // Clone the response because it can only be used once
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // Only cache same-origin requests
                                if (event.request.url.startsWith(self.location.origin)) {
                                    cache.put(event.request, responseToCache);
                                }
                            })
                            .catch(error => {
                                console.log('Cache put failed:', error);
                            });

                        return response;
                    })
                    .catch(error => {
                        console.log('Fetch failed:', error);
                        
                        // For HTML requests, return the offline page
                        if (event.request.destination === 'document' || 
                            event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/')
                                .then(response => response || new Response(
                                    '<h1>Offline</h1><p>Please check your internet connection and try again.</p>',
                                    { headers: { 'Content-Type': 'text/html' } }
                                ));
                        }
                        
                        // For other failed requests, return appropriate error
                        return new Response('Network error occurred', {
                            status: 408,
                            headers: { 'Content-Type': 'text/plain' }
                        });
                    });
            })
    );
});

// Handle background sync (optional)
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        // Handle background sync tasks here
    }
});

// Handle push notifications (optional)
self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'New update available!',
        icon: '/images/icon-192x192.png',
        badge: '/images/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Love Calculator', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // Check if there's already a window/tab open with the target URL
            for (let client of windowClients) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If not, open a new window/tab
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});