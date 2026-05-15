const cacheName = "presupuesto-hogar-pwa-v1";
const appShell = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/src/app.js?v=20260515-5",
  "/src/styles.css?v=20260515-4",
  "/src/finance.js",
  "/src/ids.js",
  "/src/liquidity.js",
  "/src/state-sync.js",
  "/assets/icon.svg",
  "/assets/icon-maskable.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/index.html")));
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return (
        cachedResponse ||
        fetch(event.request).then((networkResponse) => {
          if (event.request.method === "GET" && networkResponse.ok) {
            const responseCopy = networkResponse.clone();
            caches.open(cacheName).then((cache) => cache.put(event.request, responseCopy));
          }
          return networkResponse;
        })
      );
    })
  );
});
