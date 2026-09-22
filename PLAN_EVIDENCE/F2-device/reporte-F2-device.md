# Evidencia F2-device — Deploy del harness F2 + typo + higiene

Fecha: 2026-09-22 · Precondición: F2 en baseline (`54e3171`).

## Cambios incluidos
1. **Typo (finding #1 revisión externa):** `HINT_NO_QUAD` "recuadre" → "recuadro".
   Tests usan la constante (sin cambio de tests). 151/151 + tsc.
2. **Higiene WORKFLOW_STATE (finding #4):** bloque histórico F1-humano agrupado
   en 2 líneas (detalle en Tareas Completadas).
3. **Harness F2 de dispositivo → `f2/` (commiteado):** cámara real vía
   CameraController (D3) + worker + orchestrator + ScannerView + ScoreView +
   botón manual siempre visible + thumbnail + score + Torch (n/a sin caps) +
   toast de timeout. capturePhoto: ImageCapture (A) con fallback drawImage (B).
   Hallazgos #2 (rgbaToHist, no tocar), #3 (pico ~116MB → observar en Samsung)
   y #6 (sin performance.memory en Safari) quedan anotados, sin código.

## Verificación local (fake cam 640×480)
- Profile VGA + loop detecting ~6-10 FPS + timeout toast visible (sin quad).
- Shutter manual → ciclo capturing→revalidating→retry → detecting SIN
  congelar (fake cam borrosa no pasa revalidación — correcto por diseño; la
  ruta captured-positiva está probada en el E2E sintético noquad).
- Consola limpia (solo favicon 404). `harness-f2device.png`.

## URL para el humano (papel CON TEXTO, ambos teléfonos)
`https://jg-stevan.github.io/mobile-scanner/f2/test-harness-f2device.html?autostart=1`
Tabla de 8 validaciones en el reporte de revisión (auto<2s, no-disparo al
mover, centrar, reflejo, blanco→manual, timeout 8s, 5+ disparos, cooldown).
