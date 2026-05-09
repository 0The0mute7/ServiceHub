/* ServiceHub PWA Service Worker */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `servicehub-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `servicehub-runtime-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline.html";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/login.html",
  "/register.html",
  "/dashboard.html",
  "/services.html",
  "/service.html",
  "/create-service.html",
  "/messages.html",
  "/profile.html",
  "/styles.css",
  "/app.js",
  OFFLINE_URL,
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(STATIC_ASSETS);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) return caches.delete(key);
          return Promise.resolve();
        })
      );
      await self.clients.claim();
    })()
  );
});

const isSameOriginApi = (url) => {
  try {
    // API lives on a different origin (render). We only cache our own cached UI;
    // however we still allow network-first caching for successful GETs to help UI repeat loads.
    return url.pathname.startsWith("/api/");
  } catch {
    return false;
  }
};

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Navigate requests: network-first with offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, networkRes.clone());
          return networkRes;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cachedOffline = await cache.match(OFFLINE_URL);
          return cachedOffline || (await caches.match(OFFLINE_URL));
        }
      })()
    );
    return;
  }

  const url = new URL(req.url);

  // API GETs: network-first, cache fallback for offline UI repeat loads
  if (req.method === "GET" && isSameOriginApi(url)) {
    event.respondWith(
      (async () => {
        try {
          const networkRes = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          if (networkRes && networkRes.ok) cache.put(req, networkRes.clone());
          return networkRes;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(req);
          if (cached) return cached;
          throw new Error("Offline and no cached API response");
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  if (req.method === "GET") {
    const isStaticAsset =
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".jpeg") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.endsWith("/manifest.json") ||
      url.pathname.endsWith("/offline.html");

    if (isStaticAsset) {
      event.respondWith(
        (async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const networkRes = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, networkRes.clone());
          return networkRes;
        })()
      );
      return;
    }
  }
});

// Web Push: show notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "ServiceHub";
  const body = data.body || "You have a new notification.";

  // Try to deep-link into the message thread if we have conversationId.
  const conversationId = data.data && data.data.conversationId;
  const url = conversationId ? `/messages.html?conversationId=${conversationId}` : "/messages.html";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: `servicehub-${conversationId || "general"}`,
      icon: "/client/icons/icon-192.svg",
      data: { url },
    })
  );
});

// When user taps notification, focus/open app at target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/messages.html";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if (client.url && client.url.includes(url)) {
          client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
