# F6.2 — PWA: service worker + manifest + offline (evidencia)

**Fecha:** 2026-09-25 · **Autor:** orquestador IA (sandbox) · **Base:** origin/main @ 8444441 (F6.1)
**Alcance del plan:** F6 — PWA «manifest + Workbox (app shell + opencv.js cacheados)»
**DoD objetivo:** instalable; 2º arranque sin red; shell + opencv sobreviven offline.

## Qué se entregó

| Artefacto | Contenido |
|---|---|
| `manifest.webmanifest` | nombre, `start_url` → harness F5 (la app real), scope raíz, standalone, portrait, iconos 192/512 `purpose: any maskable` |
| `icons/icon-{192,512}.png` | documento + brackets verdes (motivo autoQuad del editor F4) sobre #111 full-bleed (maskable-safe) |
| `sw.js` (raíz, scope del sitio) | GENERADO por `scripts/build-sw.mjs` — precache calculado del artefacto vigente |
| `scripts/build-sw.mjs` | escanea HTML f4/f5 + cierre de chunks (vite cita chunks sin prefijo `assets/` → patrón nombre-base+hash8); guarda dura: falla si falta un archivo del precache |
| `scripts/build-harness-f4.mjs` / **`build-harness-f5.mjs` (nuevo)** | post-build idempotente: inyecta `<meta theme-color>` + `<link manifest>` + `apple-touch-icon` + registro SW en el HTML construido |
| Rebuild f4/ y f5/ | generaciones previas conservadas (regla 8) |

**Bonus importante:** `f5/` quedó reconstruido con el bundle `DJZDUq0c` que incluye la
cadena F6.1 — hasta ahora el worker desplegado de f5 era `DU2EpkNr` (pre-F6.1), o sea
que **f5 seguía dependiendo del CDN de opencv en dispositivo**. F6.2 mata ese SPOF residual.

## Decisiones de diseño (desviación documentada del plan)

1. **SW hecho a mano (~120 líneas) en lugar de Workbox.** El plan dice «Workbox»,
   pero Workbox via CDN sería OTRO punto único de falla exactamente del tipo que
   F6.1 eliminó (docs.opencv.org 403 Cloudflare a datacenters). La función pedida —
   app shell + opencv cacheados — es idéntica y queda sin dependencias externas.
   Workbox-build (npm) se reconsidera si el SW crece (F6.4).
2. **Inyección PWA en el HTML construido, no en la fuente.** Son concernientes de
   despliegue: las rutas `../` solo son correctas con el harness servido desde
   `f4/`/`f5/` bajo el scope del sw.js raíz. Evita además que Vite procese el
   `<link rel="manifest">` como asset (re-escribiría `start_url`/`scope` a un path
   hasheado). El build script es determinístico e idempotente (marcador).
3. **Guarda de registro:** `sw-off` param fuerza NO-registro; `sw=1` fuerza registro
   bajo `navigator.webdriver` (Playwright); producción = registro automático en
   https/localhost. Así las 4 E2E previas con stubs de red quedan aisladas SIN
   editar sus scripts (verificado por regresión).
4. **Estrategia fetch:** `navigate` network-first→caché (las actualizaciones llegan
   en cuanto hay red); resto same-origin cache-first→red (assets con hash =
   inmutables; vendor opencv 8.6MB queda cacheado tras la 1ª sesión); cross-origin
   (fallback CDN) intacto. `VERSION = sello de build` → cada regeneración de sw.js
   dispara el check del navegador → caché nueva → `activate` purga las viejas.
   `skipWaiting` + `clients.claim` (MVP: el update aplica en el siguiente reload).

## Verificación (sandbox)

**E2E nueva `test-f62-pwa-offline.mjs` — PASS 3/3:**
1. **Instalación:** boot en línea completo (`mState=detecting`, `#mOpencv=vendor/…`),
   SW `activated` y controlando (`clients.claim`), precache shell **11/11** entradas.
2. **Offline real:** `setOffline(true)` → página NUEVA en el mismo contexto →
   **boot COMPLETO desde caché**: HTML por network-first→shell, worker +
   `vendor/opencv-4.5.5.js` (8.6MB) desde precache, `mState=detecting`, 0 pageerrors.
   Captura: `f62-offline-boot.png`.
3. **Guarda:** sin `?sw` y `webdriver=true` ⇒ 0 registros (aislamiento E2E).

**Regresiones (todas verdes):** vitest 319/319 · `tsc --noEmit` limpio ·
E2E f4: typo-fix ✓, editor-fixes ✓, stale-fellback 3/3 ✓ · E2E F6.1 opencv-chain 2/2 ✓.

## Fuera de alcance (siguiente)

- **F6.3** Sentry opt-in (sin crash reporting ninguna métrica de aceptación es verificable).
- **F6.4** endurecimiento + matriz de dispositivos + checklist semanal (rotación/background/permisos revocados).
- Prompt de «nueva versión disponible» (MVP: aplica al siguiente reload — suficiente para harness).

## Pendiente del humano (dispositivo)

1. Aplicar el patch (`git am`) + push → Pages.
2. **Instalable:** en Android Chrome abrir F5 → menú → «Instalar app» / «Añadir a pantalla de inicio»; en iOS Safari → Compartir → «Añadir a inicio».
3. **2º arranque offline:** usar la app un rato con red → activar modo avión → cerrar y reabrir desde el icono → debe arrancar el shell y la cámara con opencv LOCAL (el panel de f4 lo muestra; f5 arranca sin panel pero funciona).
4. Reportar: ¿apareció el prompt de instalación? ¿arrancó offline? (2 plataformas si es posible).
