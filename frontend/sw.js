const CACHE_NAME = "lovculator-static-v2.1.0";
const API_CACHE_NAME = "lovculator-api-v2.1.0";

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
// FETCH STRATEGY (FIXED)
//
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET
  if (request.method !== "GET") return;

  // Allow external requests (images, fonts) - Network only, no cache for now
  if (url.origin !== location.origin) return;

  // 1. Components & API: Network First
  if (url.pathname.startsWith("/components/") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 2. HTML Pages: Network First → Cache Fallback → Offline Page
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If network works, return it and cache it
          if (!response || !response.ok) {
             throw new Error("Network error");
          }
          return caches.open(CACHE_NAME).then((cache) => {
             cache.put(request, response.clone()); 
             return response;
          });
        })
        .catch(async () => {
          // Network failed, try cache match
          const cachedResponse = await caches.match(request, { ignoreSearch: true });
          if (cachedResponse) return cachedResponse;

          // Try clean URL match (e.g. /profile instead of /profile.html)
          const pathResponse = await caches.match(url.pathname);
          if (pathResponse) return pathResponse;

          // Fallback to offline page
          const offlineResponse = await caches.match("/offline.html");
          if (offlineResponse) return offlineResponse;

          // Last resort: simple text response
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
          if (response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
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