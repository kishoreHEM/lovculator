const CACHE_NAME = 'lovculator-v1.1.1'; // ← UPDATE THIS VERSION EACH DEPLOYMENT
const API_CACHE_NAME = 'lovculator-api-v1.1.1';
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
  '/js/love-stories.js',
  '/js/social-share.js',
  '/js/achievements.js',
  '/js/couple-of-week.js',
  '/js/challenges.js',
  '/js/init.js',
  '/js/love-stories-api.js',
  '/js/record.js',
  '/js/simple-stats.js',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// ========================
// INSTALL EVENT
// ========================

self.addEventListener('install', event => {
    console.log('🔄 Service Worker installing...', CACHE_NAME);
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('📦 Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('✅ App shell cached successfully');
                // Force the waiting service worker to become active
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('❌ Cache installation failed:', error);
            })
    );
});

// ========================
// ACTIVATE EVENT
// ========================

self.addEventListener('activate', event => {
    console.log('🚀 Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches that don't match current version
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                        console.log('🗑️ Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('✅ Service Worker activated');
            // Take control of all clients immediately
            return self.clients.claim();
        })
    );
});

// ========================
// FETCH EVENT - UPDATED CACHE STRATEGY
// ========================

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip cross-origin requests
    if (!url.origin.startsWith(self.location.origin)) {
        return;
    }

    // Skip browser extensions and special URLs
    if (url.href.includes('chrome-extension') || 
        url.href.includes('sockjs') ||
        url.href.includes('hot-update')) {
        return;
    }

    // ========================
    // CACHE STRATEGIES
    // ========================

    // API Routes - Network First, then Cache
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Cache successful API responses
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(API_CACHE_NAME)
                            .then(cache => cache.put(request, responseClone))
                            .catch(err => console.log('API cache error:', err));
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache if network fails
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('📡 Serving API from cache:', url.pathname);
                                return cachedResponse;
                            }
                            // Return offline response for API
                            return new Response(
                                JSON.stringify({ error: 'You are offline', offline: true }),
                                { 
                                    status: 503,
                                    headers: { 'Content-Type': 'application/json' }
                                }
                            );
                        });
                })
        );
        return;
    }

    // HTML Pages - Network First (always fresh)
    if (request.destination === 'document' || 
        request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    // Always fetch fresh HTML
                    return response;
                })
                .catch(() => {
                    // Fallback to cached version
                    return caches.match(request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                console.log('📄 Serving HTML from cache:', url.pathname);
                                return cachedResponse;
                            }
                            // Fallback to index.html for SPA routing
                            return caches.match('/');
                        });
                })
        );
        return;
    }

    // Static Assets (CSS, JS, Images) - Cache First, then Network
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image') {
        
        event.respondWith(
            caches.match(request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        // Return cached version but update cache in background
                        const fetchPromise = fetch(request)
                            .then(networkResponse => {
                                if (networkResponse.status === 200) {
                                    const responseClone = networkResponse.clone();
                                    caches.open(CACHE_NAME)
                                        .then(cache => cache.put(request, responseClone))
                                        .catch(err => console.log('Cache update error:', err));
                                }
                                return networkResponse;
                            })
                            .catch(() => {
                                // Ignore fetch errors for background updates
                            });

                        // Don't wait for background update
                        event.waitUntil(fetchPromise);
                        
                        return cachedResponse;
                    }

                    // Not in cache, fetch from network
                    return fetch(request)
                        .then(response => {
                            // Cache the new resource
                            if (response.status === 200) {
                                const responseClone = response.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(request, responseClone))
                                    .catch(err => console.log('Cache put error:', err));
                            }
                            return response;
                        })
                        .catch(error => {
                            console.log('Fetch failed for:', request.url, error);
                            return new Response('Network error', { status: 408 });
                        });
                })
        );
        return;
    }

    // Default strategy for other resources
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                return cachedResponse || fetch(request);
            })
    );
});

// ========================
// MESSAGE HANDLING - FOR CACHE UPDATES
// ========================

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    console.log('🗑️ Clearing cache via message:', cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            // Notify clients that cache was cleared
            event.ports[0]?.postMessage({ success: true });
        });
    }
});

// ========================
// BACKGROUND SYNC
// ========================

self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('🔄 Background sync triggered');
        // You can add background sync for offline stories later
    }
});

// ========================
// PUSH NOTIFICATIONS
// ========================

self.addEventListener('push', event => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body || 'New update available! Refresh to see changes.',
        icon: '/images/icon-192x192.png',
        badge: '/images/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'refresh',
                title: '🔄 Refresh'
            },
            {
                action: 'close', 
                title: '❌ Close'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Lovculator Update', options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'refresh') {
        // Refresh all open windows
        event.waitUntil(
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'FORCE_REFRESH' });
                });
                return self.clients.openWindow('/');
            })
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default click behavior
        event.waitUntil(
            self.clients.matchAll({ type: 'window' }).then(windowClients => {
                for (let client of windowClients) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(event.notification.data.url);
                }
            })
        );
    }
});

// ========================
// PERIODIC SYNC FOR UPDATES
// ========================

self.addEventListener('periodicsync', event => {
    if (event.tag === 'check-updates') {    
        console.log('📡 Checking for updates...');
        event.waitUntil(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match('/').then(response => {
                    if (response) {
                        // Check if cache needs update
                        fetch('/?update-check=' + Date.now(), { cache: 'no-cache' })
                            .then(networkResponse => {
                                // Compare versions or timestamps here
                                console.log('🔄 Update check completed');
                            })
                            .catch(err => console.log('Update check failed:', err));
                    }
                });
            })
        );
    }
});