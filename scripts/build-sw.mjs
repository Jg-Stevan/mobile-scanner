#!/usr/bin/env node
// F6.2 — genera sw.js (raíz del repo, scope = raíz del sitio) con precache
// calculado del ARTEFACTO actual: HTML de f4/f5 + cierre de sus assets
// referenciados + vendor opencv + manifest + iconos. VERSION = sello de build:
// cada regeneración produce un sw.js nuevo → el navegador lo detecta en su
// check periódico → cache nueva → activate purga las viejas. Hecho a mano en
// ~120 líneas (el plan dice "Workbox"; Workbox por CDN sería OTRO SPOF tras
// el hallazgo F6.1 — la función requerida, app shell + opencv cacheados, es
// idéntica y sin dependencias).
//
// Estrategia fetch:
//  - navigate (HTML): network-first → cache (las actualizaciones llegan en
//    cuanto hay red; sin red arranca del shell cacheado)
//  - resto same-origin GET: cache-first → red (assets con hash = inmutables;
//    vendor opencv 8.6MB queda cacheado tras la 1ª sesión)
//  - cross-origin (fallback CDN de opencv): NO se toca — pasa a la red
//
// Uso: node scripts/build-sw.mjs   (correr DESPUÉS de build-harness-f4/f5)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const version = 'mscan-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);

// Cierre de assets: escanea el HTML y los .js que referencia (en cola, hasta
// estabilidad) y devuelve SOLO los assets del build vigente. Dos patrones:
//  1) 'assets/xxx.js' explícito en el HTML
//  2) chunks de vite citados SIN prefijo dentro del bundle:
//     new URL(`detection.worker-BdNYTfAg.js`, import.meta.url) — nombre-base
//     + guion + hash de 8 (evita falsos positivos tipo opencv-4.5.5.js).
// Las generaciones viejas de f*/assets/ quedan fuera del precache.
function assetsClosure(htmlRel) {
  const dir = dirname(htmlRel);
  const names = new Set();
  const scan = (text) => {
    for (const m of text.matchAll(/assets\/([A-Za-z0-9._-]+\.(?:js|css|png|jpg|svg|webmanifest))/g)) {
      names.add(m[1]);
    }
    for (const m of text.matchAll(/[A-Za-z0-9_][A-Za-z0-9._-]*-[A-Za-z0-9_-]{8}\.(?:js|css)/g)) {
      names.add(m[0]);
    }
  };
  const queue = [readFileSync(join(repo, htmlRel), 'utf8')];
  const scanned = new Set();
  while (queue.length) {
    const text = queue.shift();
    scan(text);
    for (const n of [...names]) {
      if (n.endsWith('.js') && !scanned.has(n) && existsSync(join(repo, dir, 'assets', n))) {
        scanned.add(n);
        queue.push(readFileSync(join(repo, dir, 'assets', n), 'utf8'));
      }
    }
  }
  return [...names]
    .filter((n) => existsSync(join(repo, dir, 'assets', n)))
    .map((n) => `${dir}/assets/${n}`)
    .sort();
}

const entries = [
  'f4/test-harness-f4device.html', ...assetsClosure('f4/test-harness-f4device.html'),
  'f5/test-harness-f5device.html', ...assetsClosure('f5/test-harness-f5device.html'),
  'vendor/opencv-4.5.5.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];
const PRECACHE = [...new Set(entries)];

// Guarda dura: todo lo precacheado debe existir en el artefacto (si el build
// de un harness no corrió, esto explota aquí y no en el dispositivo).
const missing = PRECACHE.filter((rel) => !existsSync(join(repo, rel)));
if (missing.length) {
  console.error('✗ build-sw: faltan archivos del precache:\n  ' + missing.join('\n  '));
  process.exit(1);
}

const sw = `/* GENERADO por scripts/build-sw.mjs (${version}) — NO editar a mano.
 * F6.2 PWA: app shell + vendor opencv cacheados; offline tras la 1ª sesión.
 * Estrategia: navigate=network-first→cache; resto same-origin=cache-first→red;
 * cross-origin (CDN fallback) intacto. */
const KEY = '${version}';
const SHELL = KEY + '-shell';
const RUNTIME = KEY + '-runtime';
const PRECACHE = ${JSON.stringify(PRECACHE, null, 2)};

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
`;

writeFileSync(join(repo, 'sw.js'), sw);
console.log(`✅ sw.js generado (${version}) — precache: ${PRECACHE.length} archivos`);
for (const rel of PRECACHE) console.log(`   · ${rel}`);
