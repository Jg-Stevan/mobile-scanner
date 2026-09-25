#!/usr/bin/env node
// Build del harness F5 → f5/ (F6.2: hermana de build-harness-f4.mjs).
// root=harnesses, base='./', entrada test-harness-f5device.html, SALIDA
// acumulativa (bundles viejos en f5/assets/ SE CONSERVAN — regla 8).
// Post-build: inyección de cabecera PWA (manifest + theme-color + icono iOS)
// y registro del service worker (../sw.js) con guardas de entorno.
// Uso: node scripts/build-harness-f5.mjs
import { build } from 'vite';
import { cp, mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const tmp = await mkdtemp(join(tmpdir(), 'f5-harness-'));

// --- Inyección PWA (idempotente) -------------------------------------------
// Se hace en el HTML CONSTRUIDO (no en la fuente) porque son concernientes de
// despliegue: las rutas ../ solo son correctas con el harness servido desde
// f4/ o f5/ bajo el scope del sw.js raíz. Marcador = idempotencia.
const HEAD_PWA = [
  '<meta name="theme-color" content="#111111">',
  '<link rel="manifest" href="../manifest.webmanifest">',
  '<link rel="apple-touch-icon" href="../icons/icon-192.png">',
].join('\n');
const SW_REG = `
<script>
/* F6.2 PWA — registro de service worker (inyectado por build-harness-*.mjs) */
(() => {
  try {
    const q = new URLSearchParams(location.search);
    if (!('serviceWorker' in navigator) || q.has('sw-off')) return;
    if (navigator.webdriver === true && !q.has('sw')) return; /* aisla E2E con stubs */
    const host = location.hostname;
    if (location.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') return;
    addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('../sw.js', document.baseURI).href).catch(() => {});
    });
  } catch (_) {}
})();
</script>`;

function injectPwa(html) {
  if (html.includes('serviceWorker.register')) return html; // ya inyectado
  let out = html.replace('</head>', `${HEAD_PWA}\n</head>`);
  out = out.replace('</body>', `${SW_REG}\n</body>`);
  return out;
}

try {
  await build({
    root: join(repo, 'harnesses'),
    base: './',
    logLevel: 'error',
    build: {
      outDir: tmp,
      emptyOutDir: true,
      rollupOptions: { input: join(repo, 'harnesses', 'test-harness-f5device.html') },
    },
  });
  const built = await readFile(join(tmp, 'test-harness-f5device.html'), 'utf8');
  await writeFile(join(tmp, 'test-harness-f5device.html'), injectPwa(built));
  // html + assets nuevos ENCIMA de los existentes (sin borrar generaciones)
  await cp(join(tmp, 'test-harness-f5device.html'), join(repo, 'f5', 'test-harness-f5device.html'));
  await cp(join(tmp, 'assets'), join(repo, 'f5', 'assets'), { recursive: true });
  console.log('✅ f5/ actualizado (generaciones previas conservadas + PWA inyectada)');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
