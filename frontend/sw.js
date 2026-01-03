const CACHE_NAME = "lovculator-static-v2.3.0";
const API_CACHE_NAME = "lovculator-api-v2.3.0";

// --- STATIC PRE-CACHE FILES ---
const urlsToCache = [
  "/", 
  "/index.html",
  "/about.html",
  "/contact.html",
  "/privacy.html",
  "/terms.html",
  "/record.html",
  "/love-stories.html",
  "/components/header.html",
  "/components/mobile-menu.html",
  "/css/style.css",
  "/css/layout.css",
  "/css/friends.css",
  "/js/app.js",
  "/js/auth.js",
  "/js/layout-manager.js",
  "/manifest.json",
  // Synchronized with your manifest filenames:
  "/images/android-chrome-192x192.png",
  "/images/android-chrome-512x512.png",
  "/offline.html"
];

// --- INSTALL ---
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// --- ACTIVATE ---
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== API_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// --- FETCH STRATEGY ---
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== location.origin) return;

  // 1. Components & API: Network First
  if (url.pathname.startsWith("/components/") || url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // 2. Navigation / HTML Pages
  if (request.mode === "navigate" || request.destination === "document") {
    const isQuestionSlug = url.pathname.startsWith("/question/") && 
                          url.pathname.split('/').filter(Boolean).length > 1;
    
    event.respondWith(
        fetch(request)
            .then((response) => {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
                return response;
            })
            .catch(async () => {
                const cachedResponse = await caches.match(request);
                if (cachedResponse) return cachedResponse;
                
                if (isQuestionSlug) {
                    const questionHtml = await caches.match('/question.html');
                    if (questionHtml) return questionHtml;
                }
                
                return caches.match("/offline.html");
            })
    );
    return;
  }

  // 3. Static Assets: Cache First
  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cached) => {
        return cached || fetch(request).then((response) => {
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});

// --- PUSH NOTIFICATIONS ---
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || "Lovculator ❤️", {
      body: data.body || "New message!",
      icon: "/images/android-chrome-192x192.png",
      badge: "/images/android-chrome-512x512.png",
      data: { url: data.url || "/" }
    })
  );
});

// --- NOTIFICATION CLICK (FIXED SYNTAX) ---
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) return client.focus();
      }
      // Otherwise open new
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});