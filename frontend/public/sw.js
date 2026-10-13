// Trackaa service worker: makes the app installable and keeps it opening when the free
// server is asleep or the phone is offline. API calls are never cached.
const CACHE = "trackaa-v6";
// How long a page request may take before we fall back to the saved copy.
const PAGE_TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function save(req, res) {
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

/**
 * Pages: always try the network first so a new deploy shows up straight away.
 * Only if the server is slow (asleep) or unreachable do we answer from the saved copy;
 * the network answer still refreshes the cache when it arrives.
 */
async function networkFirst(event) {
  const req = event.request;
  const network = fetch(req).then((res) => save(req, res));
  const timeout = new Promise((resolve) => setTimeout(resolve, PAGE_TIMEOUT_MS, "timeout"));
  try {
    const first = await Promise.race([network, timeout]);
    if (first !== "timeout") return first;
  } catch {
    /* offline: fall through to the cache */
  }
  event.waitUntil(network.catch(() => undefined));
  const hit = (await caches.match(req, { ignoreSearch: true })) || (await caches.match("/"));
  if (hit) return hit;
  return network; // nothing saved yet: keep waiting for the server
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => save(req, res))));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(event));
    return;
  }
  // Icons, manifest and other files: network, falling back to the saved copy.
  event.respondWith(fetch(req).then((res) => save(req, res)).catch(() => caches.match(req).then((hit) => hit || Response.error())));
});
