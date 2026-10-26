// Service Worker for IDA Academy Terminal (Offline & Weak Network Support)
const CACHE_NAME = "ida-academy-v1";
const OFFLINE_URL = "/?tab=academy";

// Core static assets to cache initially for offline app shell
const PRECACHE_ASSETS = [
  "/",
  "/?tab=academy",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/favicon.png",
  "/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn("[SW] Precache asset fetch error:", err);
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and API calls from caching
  if (req.method !== "GET" || url.pathname.startsWith("/api/") || url.protocol.startsWith("ws")) {
    return;
  }

  // Handle navigation requests: Network first, fallback to cached offline shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((networkRes) => {
          if (networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        })
        .catch(async () => {
          const cachedRes = await caches.match(req);
          if (cachedRes) return cachedRes;
          const fallbackShell = await caches.match(OFFLINE_URL);
          if (fallbackShell) return fallbackShell;
          return caches.match("/");
        })
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts): Cache-first with stale-while-revalidate for weak networks
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) {
          // Revalidate in background without blocking
          fetch(req)
            .then((fresh) => {
              if (fresh.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(req, fresh));
              }
            })
            .catch(() => {});
          return cached;
        }

        return fetch(req).then((networkRes) => {
          if (networkRes.status === 200) {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return networkRes;
        });
      })
    );
  }
});
