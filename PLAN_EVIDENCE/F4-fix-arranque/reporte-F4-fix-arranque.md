# Evidencia F4-fix-arranque — Harness F4 recuperable (botón iniciar + error visible + reintento)

Fecha: 2026-09-25 · Commit base: `885b76e` (F4+F5). Reportado por el humano durante la
validación F4 en dispositivo: "no funciona el shutter manual ni el automático en F4".

## Síntoma
- F4 en dispositivo: ni shutter manual ni auto-shutter responden.
- `?autostart=1` (workaround conocido del gate de arranque) NO resolvió.
- F5 en el mismo dispositivo SÍ funciona (tiene botón "Iniciar cámara").

## Diagnóstico (verificado con Playwright + build local, no solo lectura de código)
1. **Boot all-or-nothing con muerte permanente:** `main()` del harness F4 solo se
   ejecuta con `?autostart=1` y sin try/catch utilizable por el humano. Cualquier
   fallo de boot (cámara, worker, CDN) dejaba la página a medio vivir: el preview
   de video SIGUE visible (ctl.init + play ocurren ANTES del boot del worker) pero
   el shutter nunca recibe handler (se asigna al final de `main()`) y `__orch` no
   existe. Error enterrado en `#out` (pre al fondo de la página, bajo el fold móvil).
2. **Fragilidad del CDN de opencv (hallazgo de infraestructura):** el worker carga
   `https://docs.opencv.org/4.5.5/opencv.js` vía `importScripts`. Reproducido en
   sandbox: el CDN respondió **HTTP 403 con challenge Cloudflare**
   (`cf-mitigated: challenge`, "Just a moment...") tanto con UA de curl como de
   navegador móvil. `importScripts` NO puede resolver un challenge interactivo →
   boot del worker muere. En dispositivo móvil el fallo es intermitente (riesgo de
   Cloudflare por IP/reputación), consistente con "F4 falló, F5 funcionó después".
   Este riesgo fue invisible porque el error no se mostraba en paneles visibles.
3. El bundle desplegado `bmnm_UQk` corresponde a la fuente vigente (verificado por
   strings: diana, editor, captureManual) — NO era un bundle desactualizado.
4. Los named exports de los 4 módulos exclusivos de F4 (AdjustEditor, datasetStore,
   dianaMath, dataCollect) existen — sin imports rotos; tsc limpio.

## Cambios (SOLO harness — `harnesses/test-harness-f4device.html`, patrón F5 probado en dispositivo)
1. **Botón `Iniciar cámara`** (`#startBtn`) visible desde la carga: el arranque deja
   de depender del parámetro oculto `?autostart=1`.
2. **Boot con try/catch:** fallo → mensaje en `#err` (arriba, visible en móvil)
   `Inicio: <causa> — pulsa Iniciar cámara para reintentar` + botón re-habilitado.
   Éxito → botón oculto + shutter habilitado.
3. **Shutter deshabilitado hasta boot completo** (antes: habilitado y muerto — UX
   engañosa). Guard `booting/booted` evita doble arranque concurrente.
4. `?autostart=1` conservado (E2E/Playwright) vía el mismo `boot()` con catch.
5. Redeploy `f4/`: HTML + bundle `p6DGuzEj` + worker `DU2EpkNr`, generación previa
   de assets conservada (higiene de deploy, regla 8). Ruta de assets corregida a
   `./assets/` (mismo ajuste que 27a86e9).

## Verificación
- Build local + Playwright (cámara fake, CDN bloqueado en sandbox):
  - Estado inicial: startBtn habilitado, shutter deshabilitado ✓
  - Click iniciar con CDN caído: error VISIBLE en `#err` con causa exacta
    (opencv 403) + startBtn re-habilitado ✓ (antes: página bricked sin aviso)
  - Reintento: re-boot sin duplicación (guard) ✓
- Deploy simulado servido de `f4/`: 0 respuestas 404 (HTML→bundle→worker) ✓
- `npm test`: 314/314 ✓ · `npx tsc --noEmit`: limpio ✓
- No hay cambio en `src/` (el fix no toca producción, solo el harness).

## Pendientes humanos
1. **Validar F4 en dispositivo con el harness redeployado** (URL sin parámetros):
   https://jg-stevan.github.io/mobile-scanner/f4/test-harness-f4device.html
   — Si el CDN sigue desafiando en el teléfono: el error ahora es visible y el
   reintento suele bastar (el challenge pasa al reintentar desde la UI del botón).
2. Continuar la guía de validación F4 (editor/colector/diana) — Pruebas 1-3.

## Propuesta documentada (requiere decisión, NO implementado)
- **Vendorizar opencv.js 4.5.5 en el repo** (misma versión pineada, bytes
  idénticos) servido por Pages → elimina la dependencia de docs.opencv.org y su
  Cloudflare. Empata con F6 (Workbox ya planea cachear opencv.js 8MB). Obtener el
  archivo desde un navegador humano (el sandbox recibe 403 del challenge).
- Alternativa más ligera: URL de respaldo espejo SOLO si se verifica byte-identical
  4.5.5 (npm @techstark arranca en 4.7 — NO sirve sin violar el pin).

## Prohibiciones respetadas
- Sin cambios en `src/core/`, umbrales, decisiones congeladas ni CDN/versión de
  opencv (4.5.5 intacto). `tests/bench/` y `PLAN_EVIDENCE/` intocados salvo este
  reporte. Sin aspect ratios hardcodeados (n/a).
