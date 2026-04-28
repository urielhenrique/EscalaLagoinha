const VERSION = "v3";
const APP_CACHE = `escala-lagoinha-app-${VERSION}`;
const ASSET_CACHE = `escala-lagoinha-assets-${VERSION}`;
const API_CACHE = `escala-lagoinha-api-${VERSION}`;

const KNOWN_CACHES = [APP_CACHE, ASSET_CACHE, API_CACHE];

const APP_SHELL = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa/icon-192.svg",
  "/pwa/icon-512.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) =>
        cache.addAll(APP_SHELL.filter((url) => !url.includes("screenshot"))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !KNOWN_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (request.mode === "navigate") {
      const offlinePage = await caches.match("/offline.html");
      if (offlinePage) return offlinePage;
      const appShell = await caches.match("/index.html");
      if (appShell) return appShell;
    }

    return new Response(
      JSON.stringify({
        error: "Offline",
        message: "Sem conexão com a internet",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || networkPromise;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  const isAssetRequest =
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".js"));

  if (isAssetRequest) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  const isApiRequest =
    url.pathname.startsWith("/api/") ||
    (url.origin.includes("localhost:3000") && url.pathname.startsWith("/api/"));

  if (isApiRequest) {
    event.respondWith(networkFirst(request, API_CACHE));
  }
});
