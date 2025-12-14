const CACHE_NAME = "lovculator-static-v2.3.0";
const API_CACHE_NAME = "lovculator-api-v2.3.0";

//
// STATIC PRE-CACHE FILES
//
const urlsToCache = [
  "/", 
  "/index.html",

  // Static clean pages
  "/about.html",
  "/contact.html",
  "/privacy.html",
  "/terms.html",
  "/record.html",
  "/love-stories.html",

  // Global components (VERY IMPORTANT)
  "/components/header.html",
  "/components/mobile-menu.html",

  // Assets
  "/css/style.css",
  "/css/layout.css",     // Added missing layout css
  "/css/friends.css",    // Added missing friends css
  "/js/app.js",
  "/js/auth.js",         // Critical scripts
  "/js/layout-manager.js",
  "/manifest.json",

  "/images/icon-192x192.png",
  "/images/icon-512x512.png",

  // Offline fallback page
  "/offline.html"
];

//
// INSTALL
//
self.addEventListener("install", (event) => {
  console.log("🔄 SW Install:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
      .catch((err) => console.error("❌ Install cache failed:", err))
  );
});

//
// ACTIVATE
//
self.addEventListener("activate", (event) => {
  console.log("🚀 SW Activate");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            console.log("🗑 Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

//
// FETCH STRATEGY (FIXED: Race Condition & Clean URLs)
//
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET
  if (request.method !== "GET") return;

  // Allow external requests (images, fonts) - Network only
  if (url.origin !== location.origin) return;

  // 1. Components & API: Network First
  if (url.pathname.startsWith("/components/") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // In the FETCH STRATEGY section, modify the HTML Pages handling:
if (request.mode === "navigate" || request.destination === "document") {
    // Check if this is a clean question URL
    const cleanUrl = new URL(request.url);
    const isQuestionSlug = cleanUrl.pathname.startsWith("/question/") && 
                          cleanUrl.pathname.split('/').filter(Boolean).length > 1;
    
    // Create a cache key that preserves the original clean URL
    const cacheKey = isQuestionSlug ? '/question.html' : request;
    
    event.respondWith(
        fetch(request)
            .then((response) => {
                if (!response || !response.ok) {
                    throw new Error("Network error");
                }
                
                // Clone response before caching
                const responseToCache = response.clone();
                
                caches.open(CACHE_NAME).then((cache) => {
                    // Cache with the clean URL as key
                    cache.put(request, responseToCache);
                });
                
                return response;
            })
            .catch(async () => {
                // Try to get from cache using original request
                const cachedResponse = await caches.match(request);
                if (cachedResponse) return cachedResponse;
                
                // For question slugs, try to serve question.html
                if (isQuestionSlug) {
                    const questionHtml = await caches.match('/question.html');
                    if (questionHtml) return questionHtml;
                }
                
                // Try offline page
                const offlineResponse = await caches.match("/offline.html");
                if (offlineResponse) return offlineResponse;
                
                return new Response("You are offline.", {
                    status: 503,
                    headers: { "Content-Type": "text/plain" }
                });
            })
    );
    return;
}
  // 3. Static Assets (JS/CSS/Images): Cache First -> Network Fallback
  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        if (cached) return cached;

        return fetch(request).then((response) => {
          // Check for valid response before caching
          if (response.status === 200) {
            // ✅ FIX: Clone IMMEDIATELY here too
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // Default: Cache first for anything else
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});

//
// SERVICE WORKER COMMANDS
//
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();

  if (event.data?.type === "CLEAR_CACHE") {
    caches.keys().then((names) => {
      names.forEach((n) => caches.delete(n));
    });
  }
});

//
// PUSH NOTIFICATIONS
//
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || "Lovculator ❤️", {
      body: data.body || "New message!",
      icon: "/images/icon-192x192.png",
      badge: "/images/icon-192x192.png",
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || "/")
  );
});