// Trackaa service worker: makes the app installable and opens it instantly, even while
// the free server is asleep. API calls are never cached, so numbers are always fresh.
const CACHE = "trackaa-v5";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function fromNetwork(req) {
  const res = await fetch(req);
  if (res.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

async function cacheFirst(req) {
  return (await caches.match(req)) || fromNetwork(req);
}

/** Serve the cached page now; refresh it in the background and tell the app if a new version arrived. */
async function staleWhileRevalidate(event) {
  const req = event.request;
  const isPage = req.mode === "navigate";
  const hit = await caches.match(req, { ignoreSearch: isPage });

  const refresh = fetch(req)
    .then(async (res) => {
      if (!res.ok) return res;
      if (hit && isPage) {
        const [oldText, newText] = await Promise.all([hit.clone().text(), res.clone().text()]);
        if (oldText !== newText) {
          const clients = await self.clients.matchAll({ type: "window" });
          clients.forEach((c) => c.postMessage({ type: "trackaa:update-ready" }));
        }
      }
      const cache = await caches.open(CACHE);
      await cache.put(req, res.clone());
      return res;
    })
    .catch(() => undefined);

  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  const res = await refresh;
  if (res) return res;
  if (isPage) {
    const shell = await caches.match("/");
    if (shell) return shell;
  }
  return Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Hashed build files never change.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req).catch(() => Response.error()));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
