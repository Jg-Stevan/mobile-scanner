# Reporte F6.4 — Robustez de errores + Matriz de dispositivos

**Fecha:** 2026-09-26 · **Agente:** Super Z (orquestador) · **Estado:** completo en sandbox, pendiente `git am` + validación en dispositivo

Alcance: filas restantes de PLAN §F6 — *"Errores: Permisos denegados, sin
getUserMedia, cámara ocupada, rotación, background"* y *"Matriz de dispositivos:
documentada desde F0 + checklist de regresión semanal (rotación, background,
permisos revocados)"*. Con esto, §F6 queda cerrada salvo la validación humana
en dispositivo (DoD: instalable ✓ · 2º arranque <2s · sobrevive
rotación/background en la matriz documentada).

## Entregables

| Archivo | Rol |
|---|---|
| `src/camera/cameraErrors.ts` (NUEVO) | clasificación PURA: `classifyCameraError(err)` → `{code,title,hint,retryable}`; por `err.name` (tabla MDN + alias) Y por mensaje (cubre errores envueltos) |
| `src/camera/CameraController.ts` | `CameraInitError` (`.code` + `.cause`), mensajes históricos intactos (/3 niveles/, /sin cámaras/); init() conserva el error del desbloqueo; `getTrack()` |
| `src/camera/lifecycle.ts` (NUEVO) | `attachLifecycle` (visibilidad con deps inyectables) + `trackIsLive` (muted NO invalida — transitorio de iOS) |
| `src/scan/ScanOrchestrator.ts` | `extendDeadline()`: re-arma el plazo de 8s al volver de background; no-op fuera de `detecting` |
| `harnesses/test-harness-f4device.html` | catch clasificado, `f4WireGuards` (ended + watchOrientation D2), `f4MarkCamLost`/`f4Reactivate`, lifecycle onVisible, `window.__f4orch` |
| `harnesses/test-harness-f5device.html` | mismo patrón (MSG_LOST/markCamLost/reactivateCamera/wireCameraGuards/lifecycle) |
| `docs/matriz-dispositivos.md` (NUEVO) | matriz (SM-A566E / iPhone 17 Pro / Playwright) + hallazgos históricos + checklist semanal W1–W11 + log de rondas |
| `tests/cameraErrors.test.ts`, `tests/lifecycle.test.ts` (NUEVOS) | 17 + 9 casos |
| `tests/cameraController.test.ts`, `tests/scanOrchestrator.test.ts` | +CameraInitError (permission/busy/no-device/unlock-path/getTrack) + extendDeadline (control + no-op) |
| `scripts/test-f64-robustez.mjs` (sandbox) | E2E 4 casos sobre el artefacto |
| `PLAN_EVIDENCE/F6/robustez/f64-*.png` | capturas de los banners (permiso denegado, cámara perdida) |

## Decisiones de diseño

1. **Clasificar SOLO `CameraInitError`** en los catch de boot: la regresión de
   F6.1 (`opencv-chain`) lo destapó — envolver el fallo de la cadena de opencv
   (que lista sus 3 candidatos) en un mensaje de "cámara" sería mentir dos veces.
   Los demás errores pasan intactos con su detalle real.
2. **El reintento NO reconstruye la app:** al perder el track (`ended`), el
   frameLoop/workers/galería quedan vivos (el backpressure tolera video muerto);
   Iniciar re-adquiere SOLO la cámara. Re-entrar a `openCamera` completo duplicaría
   galería/workers (PageGallery no limpia su root).
3. **FrameLoop no se toca:** rAF/rVFC ya dejan de disparar con la pestaña oculta;
   el riesgo real era el **falso toast de timeout** al volver → `extendDeadline()`
   en el evento `visible` (y validación del track con `trackIsLive`).
4. **`muted` no mata:** los ciclos de foco/exposición de iOS parpadean `muted`;
   el health check estricto es `readyState==='live'` + evento `ended`.
5. **Headless quirk:** este Chromium headless mapea la DENEGACIÓN de cámara a
   `NotSupportedError` (probado con CDP `Browser.setPermission: denied` — mismo
   resultado). Los dispositivos reales lanzan `NotAllowedError`. E2E Caso 1
   inyecta el fallo estándar con `addInitScript` (pipeline completo: unlock →
   probes → clasificación → banner → reintento); el disparo REAL del navegador
   queda en el checklist W4 (dispositivo).

## Verificación

- **Unit:** 356/356 (+26 nuevos), `tsc --noEmit` limpio.
- **E2E nueva `test-f64-robustez.mjs` 4/4:**
  1. *Permiso denegado (f4):* banner `Inicio: Permiso de cámara denegado. Permite
     la cámara…`, pista accionable, Iniciar habilitado, 0 pageerrors.
  2. *Rotación en vivo (f5):* viewport 420×900 → 900×420: overlay 640×480 →
     640×360 (landscape), `mState=detecting` intacto, 0 pageerrors.
  3. *Background (f5):* `hidden`→ extendDeadline NO se llama; `visible`→ se
     llama 1 vez (spy sobre `__f5orch`); track sigue `live`.
  4. *Track ended (f5):* evento `ended` (sintético — `stop()` no lo dispara por
     spec) → banner "Cámara perdida…", shutter bloqueado, Iniciar habilitado →
     recuperación: shutter activo, track nuevo `live`, orquestador activo.
- **Regresión completa (7 suites):** typo-fix ✓ · editor-fixes ✓ ·
  stale-fellback ✓ · opencv-chain 2/2 ✓ (tras decisión 1) · pwa-offline 3/3 ✓ ·
  telemetría ✓ · robustez 4/4 ✓.
- Builds regenerados: f4 (`aaxWgiGM`), f5 (`Og5uPDiT`), `sw.js` precache 11/11.

## Fuera de alcance (documentado)

- Toast de "nueva versión disponible" del SW: MVP actual (efectiva en la próxima
  recarga) se mantiene; se evaluará si el SW crece en post-MVP.
- Torch del f4 tras reactivación de cámara: estado del botón puede quedar obsoleto
  (el perfil se re-perfila; el toggle re-evalúa al pulsar). Riesgo menor aceptado.
- F6.5 (modelo ONNX): condicional, fuera de esta entrega.

## Humano (pendiente)

1. `git am download/f6.4-robustez.patch` + push (Pages se actualiza solo).
2. Primera ronda del **checklist W** (`docs/matriz-dispositivos.md`) en ambos
   teléfonos: W1 opencv local, W2 rotación, W3 background, W4 permisos revocados
   en vivo (disparo REAL del navegador), W5 cámara ocupada; anotar resultados en
   el log de rondas.
3. Las pruebas A/B/PWA de la ronda anterior siguen pendientes si no se hicieron.
