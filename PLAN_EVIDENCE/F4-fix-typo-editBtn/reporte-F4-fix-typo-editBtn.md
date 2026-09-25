# Evidencia F4-fix-typo-editBtn — Causa raíz REAL del F4 muerto en dispositivo (typo `$('#editBtn')`)

Fecha: 2026-09-25 · Commit base: `6403db4` (F4-fix-arranque, aplicado y pusheado
por el humano). Corrige el diagnóstico incompleto de `PLAN_EVIDENCE/F4-fix-arranque/`.

## Contexto
- El humano aplicó y pusheó el fix de arranque (`6403db4`, verificado idéntico al
  parche generado). Pages sirve el bundle nuevo `p6DGuzEj` (verificado HTTP 200 +
  hash en HTML desplegado).
- El humano envió videos f3/f4 como muestra del estado (los videos NO llegaron al
  sandbox — carpeta upload vacía; no obstrucción al diagnóstico: la causa era
  reproducible por lectura de código + E2E del artefacto).

## Causa raíz REAL (en el dispositivo del humano)
Typo en `harnesses/test-harness-f4device.html` línea 452 (fuente pre-fix):

```js
const $ = (id) => document.getElementById(id);   // línea 140 — SIN '#'
$('#editBtn').onclick = () => { ... };           // línea 452 — CON '#'
```

- `document.getElementById('#editBtn')` → **null** (el id real es `editBtn`) →
  `null.onclick = ...` → **TypeError: Cannot set properties of null**.
- `main()` muere en la línea 451-452, ANTES de:
  - `startFrameLoop(...)` (línea 459+) → **sin stream de detección → auto-shutter muerto**
  - `$('shutterBtn').onclick = ...` (línea 484) → **shutter manual muerto**
- La cámara YA fue inicializada (líneas previas) → preview vivo: la página "parece"
  arrancada pero los botones no responden. Con el fix previo el error ahora es
  visible en `#err`, pero el shutter seguía muerto: por eso el humano reportaba
  el fallo persistente tras aplicar el primer parche.

## Por qué el primer diagnóstico no lo encontró (lección registrada)
1. En sandbox, el boot moría ANTES (CDN opencv 403 challenge Cloudflare en el
   worker) → la E2E del primer fix solo validó el camino de fallo visible +
   reintento; NUNCA ejercitó un boot COMPLETO hasta el final de `main()`.
2. F5 funciona en el dispositivo del humano usando el MISMO `detection.worker.ts`
   y el MISMO CDN → demuestra que en la red del dispositivo el CDN carga bien
   (el 403 es anti-bot de datacenter/automatización, no afecta al Chrome móvil
   del humano). La fragilidad CDN sigue siendo hallazgo de infra válido (F6/PWA),
   pero NO era el causante del síntoma reportado.
3. El typo `$('#editBtn')` existe SOLO en el harness F4 (F5 no lo tiene) →
   consistente con "F4 muerto, F5 vivo".

## Cambios
1. `harnesses/test-harness-f4device.html` línea 452: `$('#editBtn')` →
   `$('editBtn')` (1 carácter). Sin otros cambios de código.
2. Rebuild `f4/` con config vite temporal (`base: './'`, entrada del harness,
   borrada tras el build): HTML apunta a bundle nuevo
   `test-harness-f4device-DW_MiY1r.js`; worker `DU2EpkNr` sin cambios (hash
   estable); **generación previa de assets conservada** (higiene regla 8).

## Verificación (E2E del artefacto de build, no del fuente)
Servido `f4/` estático + Playwright cámara fake + **stub del CDN opencv**
(`page.route` → define `self.cv` y dispara `onRuntimeInitialized`) para permitir
boot completo en sandbox:
- Boot éxito: shutter habilitado, startBtn oculto, FSM `detecting` (frameLoop vivo) ✓
- `window.__orch` y `window.__editor` definidos → `main()` llegó al FINAL
  (con el typo esto era imposible) ✓
- Click shutter manual: sin excepción; app responsiva; el error del worker
  ("e.Mat is not a constructor") es del STUB (sin Mat real) — en dispositivo el
  opencv real carga completo (F5 lo demuestra) ✓
- 0 pageerrors en todo el flujo ✓ (antes: TypeError null.onclick)
- Script: `scripts/test-f4-typo-fix.mjs` (sandbox) · screenshot `f4-typo-fix-e2e.png`
- `npm test`: 314/314 ✓ · `npx tsc --noEmit`: limpio ✓
- Sin cambios en `src/` (solo harness + build de deploy).

## Pendientes humanos
1. Aplicar el parche y pushear (mismo flujo que `6403db4`).
2. Reintentar F4 en dispositivo (URL sin parámetros):
   https://jg-stevan.github.io/mobile-scanner/f4/test-harness-f4device.html
   → pulsar "Iniciar cámara" → shutter debe responder (manual y auto).
3. Continuar la guía de validación F4 (editor/colector/diana — Pruebas 1-3).

## Prohibiciones respetadas
Sin cambios en `src/`, umbrales, decisiones congeladas ni CDN/versión de opencv
(4.5.5 intacto). `tests/bench/` y `PLAN_EVIDENCE/` intocados salvo este reporte.
