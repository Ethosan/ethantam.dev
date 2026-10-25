// Service worker for ethantam.dev: offline-first, cache static assets.
const CACHE = "ethantam-v6";
const PRECACHE = [
  "/",
  "/index.html",
  "/resume",
  "/resume.js",
  "/share.js",
  "/assets/qr.svg",
  "/styles.css",
  "/main.js",
  "/noscript.css",
  "/fonts.css",
  "/assets/mark.svg",
  "/assets/tulips.webp",
  "/assets/og.png",
  "/assets/apple-touch-icon.png",
  "/assets/fonts/geist-latin.woff2",
  "/assets/fonts/geist-mono-latin.woff2",
  "/assets/fonts/instrument-serif-italic-latin.woff2",
  "/manifest.json",
  "/404.html",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls or external requests
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;

  // Network-first for HTML, CSS, JS and the CV's PDF so deploys show up on the next load; cache-first for images and fonts
  if (request.destination === "document" || /\.(html|css|js|pdf)$/.test(url.pathname)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/404.html")))
    );
  } else {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return res;
        });
      })
    );
  }
});
