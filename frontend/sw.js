// ===========================================================
// LOVCULATOR PWA SERVICE WORKER v3.0
// Production-ready with Play Store compliance
// ===========================================================

const APP_VERSION = '3.0.0';
const CACHE_NAME = `lovculator-static-v${APP_VERSION}`;
const API_CACHE_NAME = `lovculator-api-v${APP_VERSION}`;
const IMAGE_CACHE_NAME = `lovculator-images-v${APP_VERSION}`;

// 🔥 CRITICAL: Files needed for App Shell (First Paint)
const CRITICAL_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/qa.css',
  '/manifest.json',
  '/images/android-chrome-192x192.png',
  '/images/android-chrome-512x512.png',
  '/images/favicon.ico',
  '/offline.html'
];

// 🔥 IMPORTANT: App Shell components
const APP_SHELL_FILES = [
  '/components/header.html',
  '/components/mobile-menu.html',
  '/components/global-login-modal.html',
  '/components/guest-header.html'
];

// 📱 Core PWA pages
const CORE_PAGES = [
  '/love-calculator.html',
  '/love-stories.html',
  '/answer.html',
  '/question.html',
  '/ask.html',
  '/profile.html',
  '/messages.html',
  '/notifications.html',
  '/search.html'
];

// ===========================================================
// INSTALL EVENT - Cache App Shell
// ===========================================================
self.addEventListener('install', event => {
  console.log(`📱 Lovculator PWA v${APP_VERSION} installing...`);
  
  event.waitUntil(
    (async () => {
      try {
        // 1. Open caches
        const staticCache = await caches.open(CACHE_NAME);
        const apiCache = await caches.open(API_CACHE_NAME);
        const imageCache = await caches.open(IMAGE_CACHE_NAME);
        
        console.log('✅ Caches opened');

        // 2. Cache Critical Files (App Shell)
        console.log('📦 Caching critical files...');
        await Promise.all(
          CRITICAL_FILES.map(url => 
            staticCache.add(url).catch(err => 
              console.warn(`⚠️ Failed to cache ${url}:`, err.message)
            )
          )
        );

        // 3. Cache App Shell Components (with fallbacks)
        console.log('🔧 Caching app shell components...');
        for (const url of APP_SHELL_FILES) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              await staticCache.put(url, response);
              console.log(`✅ Cached: ${url}`);
            }
          } catch (err) {
            console.warn(`⚠️ Component not found: ${url}`);
          }
        }

        // 4. Skip waiting to activate immediately
        await self.skipWaiting();
        console.log('🎉 Service Worker installed successfully!');
        
      } catch (error) {
        console.error('❌ Installation failed:', error);
        // Still activate even if caching fails
        await self.skipWaiting();
      }
    })()
  );
});

// ===========================================================
// ACTIVATE EVENT - Clean up old caches
// ===========================================================
self.addEventListener('activate', event => {
  console.log('🔄 Service Worker activating...');
  
  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.map(key => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME && key !== IMAGE_CACHE_NAME) {
            console.log(`🗑️ Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );

      // Claim clients immediately
      await self.clients.claim();
      console.log('✅ Service Worker activated and ready!');
      
      // Optional: Notify all clients that SW is ready
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SW_ACTIVATED',
          version: APP_VERSION
        });
      });
    })()
  );
});

// ===========================================================
// FETCH STRATEGY - Smart Caching
// ===========================================================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ❌ Skip non-GET requests and external URLs
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // ============================================
  // 1. NAVIGATION REQUESTS (HTML Pages)
  // ============================================
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          // Try network first for fresh content
          const networkResponse = await fetch(request);
          
          // Clone response for caching
          const responseToCache = networkResponse.clone();
          
          // Cache successful responses
          if (networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, responseToCache).catch(err => 
              console.warn('Cache put failed:', err)
            );
          }
          
          return networkResponse;
          
        } catch (networkError) {
          console.log('🌐 Network failed, trying cache...');
          
          // Try cache for HTML pages
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // For question pages, serve question.html template
          if (url.pathname.startsWith('/question/')) {
            const questionTemplate = await caches.match('/question.html');
            if (questionTemplate) return questionTemplate;
          }
          
          // Fallback to offline page
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) return offlinePage;
          
          // Ultimate fallback
          return new Response(
            '<h1>Offline</h1><p>Please check your connection.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      })()
    );
    return;
  }

  // ============================================
  // 2. API REQUESTS (Network First)
  // ============================================
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          
          // Cache successful API responses (but not auth endpoints)
          if (networkResponse.status === 200 && 
              !url.pathname.includes('/auth/') && 
              !url.pathname.includes('/messages/')) {
            const apiCache = await caches.open(API_CACHE_NAME);
            apiCache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
          
        } catch (error) {
          // Try cache for API failures
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Return offline-friendly API response
          return new Response(
            JSON.stringify({ 
              error: 'offline', 
              message: 'You are offline. Please check your connection.' 
            }),
            { 
              headers: { 
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store' 
              } 
            }
          );
        }
      })()
    );
    return;
  }

  // ============================================
  // 3. STATIC ASSETS (Cache First)
  // ============================================
  if (['style', 'script', 'image', 'font'].includes(request.destination)) {
    event.respondWith(
      (async () => {
        // Try cache first
        const cachedResponse = await caches.match(request, { ignoreSearch: true });
        if (cachedResponse) {
          return cachedResponse;
        }
        
        try {
          // Not in cache, try network
          const networkResponse = await fetch(request);
          
          // Cache successful responses
          if (networkResponse.status === 200) {
            const cache = request.destination === 'image' 
              ? await caches.open(IMAGE_CACHE_NAME)
              : await caches.open(CACHE_NAME);
            
            cache.put(request, networkResponse.clone());
          }
          
          return networkResponse;
          
        } catch (error) {
          // Asset not found - return appropriate fallback
          if (request.destination === 'image') {
            return caches.match('/images/image-error.png');
          }
          
          return new Response('', { status: 404 });
        }
      })()
    );
    return;
  }

  // ============================================
  // 4. DEFAULT: Cache with Network Fallback
  // ============================================
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).catch(() => {
        // Ultimate fallback for other file types
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/offline.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ===========================================================
// PUSH NOTIFICATIONS
// ===========================================================
self.addEventListener('push', event => {
  if (!event.data) return;
  
  let notificationData;
  try {
    notificationData = event.data.json();
  } catch (err) {
    notificationData = {
      title: 'Lovculator',
      body: event.data.text() || 'New update!',
      icon: '/images/android-chrome-192x192.png'
    };
  }

  const options = {
    body: notificationData.body || 'New message!',
    icon: notificationData.icon || '/images/android-chrome-192x192.png',
    badge: '/images/android-chrome-192x192.png',
    tag: notificationData.tag || 'lovculator-notification',
    data: {
      url: notificationData.url || '/',
      timestamp: Date.now()
    },
    actions: notificationData.actions || [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    vibrate: [200, 100, 200],
    requireInteraction: notificationData.important || false
  };

  event.waitUntil(
    self.registration.showNotification(
      notificationData.title || 'Lovculator ❤️',
      options
    )
  );
});

// ===========================================================
// NOTIFICATION CLICK HANDLER
// ===========================================================
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const targetUrl = notificationData.url || '/';

  event.waitUntil(
    (async () => {
      // Handle action buttons
      if (event.action === 'open' || event.action === '') {
        // Try to focus existing window
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

        // Check if there's already a window open
        for (const client of clients) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            await client.focus();
            return client.navigate(targetUrl);
          }
        }

        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      } else if (event.action === 'dismiss') {
        // Notification dismissed, do nothing
        console.log('Notification dismissed');
      }
    })()
  );
});

// ===========================================================
// BACKGROUND SYNC (for offline actions)
// ===========================================================
self.addEventListener('sync', event => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  } else if (event.tag === 'sync-comments') {
    event.waitUntil(syncComments());
  }
});

// ===========================================================
// MESSAGE HANDLER (for communication with app)
// ===========================================================
self.addEventListener('message', event => {
  const { data } = event;
  
  switch (data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.keys().then(keys => {
        keys.forEach(key => caches.delete(key));
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.keys().then(keys => {
        event.source.postMessage({
          type: 'CACHE_INFO',
          caches: keys,
          version: APP_VERSION
        });
      });
      break;
      
    case 'PRE_CACHE_PAGE':
      if (data.url) {
        caches.open(CACHE_NAME).then(cache => {
          fetch(data.url).then(response => {
            if (response.ok) {
              cache.put(data.url, response);
            }
          });
        });
      }
      break;
  }
});

// ===========================================================
// HELPER FUNCTIONS
// ===========================================================
async function syncLikes() {
  // Implement offline like syncing
  console.log('Syncing offline likes...');
}

async function syncComments() {
  // Implement offline comment syncing
  console.log('Syncing offline comments...');
}

// ===========================================================
// PERIODIC SYNC (for background updates)
// ===========================================================
self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-content') {
    event.waitUntil(updateCachedContent());
  }
});

async function updateCachedContent() {
  console.log('Updating cached content...');
  // Update critical files
  const cache = await caches.open(CACHE_NAME);
  for (const url of CRITICAL_FILES) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
      }
    } catch (err) {
      console.warn(`Failed to update ${url}:`, err);
    }
  }
}

// ===========================================================
// ERROR HANDLING
// ===========================================================
self.addEventListener('error', event => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('Service Worker unhandled rejection:', event.reason);
});

// Console log for debugging
console.log(`🚀 Lovculator PWA Service Worker v${APP_VERSION} loaded`);
