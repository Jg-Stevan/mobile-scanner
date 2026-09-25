/* GENERADO por scripts/build-sw.mjs (mscan-20260925181849) — NO editar a mano.
 * F6.2 PWA: app shell + vendor opencv cacheados; offline tras la 1ª sesión.
 * Estrategia: navigate=network-first→cache; resto same-origin=cache-first→red;
 * cross-origin (CDN fallback) intacto. */
const KEY = 'mscan-20260925181849';
const SHELL = KEY + '-shell';
const RUNTIME = KEY + '-runtime';
const PRECACHE = [
  "f4/test-harness-f4device.html",
  "f4/assets/detection.worker-BdNYTfAg.js",
  "f4/assets/test-harness-f4device-DfxP63vz.js",
  "f5/test-harness-f5device.html",
  "f5/assets/detection.worker-BdNYTfAg.js",
  "f5/assets/pdfExport-Cbr_t6PA.js",
  "f5/assets/test-harness-f5device-Cahklv6H.js",
  "vendor/opencv-4.5.5.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await Promise.allSettled(PRECACHE.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('mscan-') && !k.startsWith(KEY))
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; /* CDN fallback atraviesa */

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(req, { ignoreSearch: true });
        return cached || Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const fresh = await fetch(req);
      if (fresh.ok && fresh.type === 'basic') {
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return Response.error();
    }
  })());
});
