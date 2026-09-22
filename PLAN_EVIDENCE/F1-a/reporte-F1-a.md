# Evidencia F1-a — Correctiva de auditoría (harness cámara + fix error→freeze)

Fecha: 2026-09-22 · Precondición: F1 en baseline (`f1bdcef`).

## Verificación previa de la auditoría (fuente, no bundle)
- Crítico #1 CONFIRMADO: 0× `getUserMedia` en el bundle → test de dispositivo
  imposible. Crítico #2 CONFIRMADO en `src/camera/frameLoop.ts:109-117`:
  'error' → onStatus sin resetear busy → descarte permanente.

## Cambios
1. **frameLoop.ts (fix crítico #2):** 'error' resetea busy + viaja por onStatus
   (el frame en vuelo se perdió; el worker ya liberó el suyo en finally).
   Test: tras 'error', el siguiente frame se envía (posted 1→2, dropped 0).
2. **frameLoop.ts (hallazgo 7):** `captureErrors` en stats (racha consecutiva,
   reset al enviar). Test: 2 fallos → 2; éxito → 0.
3. **CameraController.init (hallazgo NUEVO del E2E, no de la auditoría):** en
   origen fresco los labels/ids vienen vacíos → unlock con stream genérico
   (se cierra) antes de enumerar, como el spike. Sin esto, mode=camera muere
   con "sin cámaras" en cualquier navegador sin permiso previo. Test dedicado.
4. **pipeline.ts (hallazgo 3, SIN cambio lógico):** `MIN_CONTOUR_AREA_RATIO` →
   `MIN_CONTOUR_AREA_PCT` + origen HONESTO (prefiltro de ingeniería: <0.5%
   nunca pasaría validateQuad ≥25%; NO fue calibrado en benchmark — no se
   fabrica procedencia). Bundle minificado idéntico en comportamiento
   (worker hash inalterado salvo el fix, verificado).
5. **protocol.ts (hallazgo 5):** nota de recalibración F2 (crop 270×480 vs 480p).
6. **Harness mode=camera:** CameraController (D3) + métricas + botón Torch
   (cubre el pendiente T6) + hooks `__f1worker`/`__f1stats` (temporales).
   'live' sintético intacto. Harness recreado temporalmente, borrado tras build.
7. Hallazgos 4/6: aceptados como notas (custom OpenCV pre-producción; sin
   performance.memory en Safari) — sin acción de código.

## Verificación (Playwright, fake cam 640×480)
- mode=camera: VGA seleccionada por D3-fallback, 817 resultados, 13.6 FPS,
  latencia p95 29.2ms, captureErrors 0. `mode-camera.json` + screenshot.
- Error SIMULADO en vivo: sent 788 → 817 (+29, tasa completa inmediata;
  sin fix se habría congelado en 788). Bug cazado y muerto.
- Regresión live sintética: bundle verificado antes (gtErr 0.0024, F1).
- 119/119 tests + tsc limpio.

## Prohibiciones respetadas
- pipeline.ts/worker: solo renombre+comentario (cero lógica). core/, spike.html,
  tests/bench/ intactos. Sin setInterval (setTimeout encadenados).
