/* Mira service worker: makes the installed PWA open instantly and offline.
 *
 * - Hashed bundles under /_expo/static/ never change: cache-first, kept forever.
 * - The app shell (HTML) is network-first, so a new deploy shows up on the next
 *   open; when offline the cached shell is served.
 * - /api/* and the /sync WebSocket are never touched.
 */
const SHELL_CACHE = "mira-shell-v1";
const ASSET_CACHE = "mira-assets-v1";
const SHELL_URLS = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(ASSET_CACHE)).put(request, response.clone());
  return response;
};

const networkFirstShell = async (request) => {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL_CACHE)).put("/", response.clone());
    return response;
  } catch {
    return (await caches.match("/")) || Response.error();
  }
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/sync")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstShell(request));
  } else if (url.pathname.startsWith("/_expo/static/") || url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request));
  }
});
