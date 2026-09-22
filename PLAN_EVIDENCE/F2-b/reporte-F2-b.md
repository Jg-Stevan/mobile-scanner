# Evidencia F2-b — Ventanas 600ms + timeout sin vibrar (P4 rechazada → D8)

Fecha: 2026-09-22 · Precondición: F2-a en baseline (`6f58412`).
Aprobación humana: ventanas 300→600 + no vibrar en timeout + P4 rechazada → D8.

## Cambios
1. **quality.ts:** `STABILITY_WINDOW_MS` y `SHUTTER_HOLD_MS` 300→600 con origen
   (video acta densa a 2.9 FPS: muestras cada ~345ms nunca caen en 300ms →
   inanición → estabilidad 0 → score techo ~0.65 → auto no dispara; las 2
   capturas previas fueron manuales).
2. **ScanOrchestrator.notify:** `kind==='timeout'` → `return 'none'` sin vibrar
   (antes vibraba cada 8s, indistinguible de captura).
3. **Tests:** shutter con espaciado de acta (345ms, 600ms) + estabilidad con
   ventana 600ms (distingue dentro/fuera) + timeout no vibra (default notify
   con stub).
4. **WORKFLOW_STATE:** D8 activa (proceso 300px rechazado, FPS denso aceptado
   bajo), hallazgo "documento denso" actualizado (F2-b corrige inanición).
5. **Redeploy /f2/** con ambos fixes (bundle verificado: `STABILITY_WINDOW`
   600 y `timeout` sin vibrate; métrica Contornos en vivo).

## Verificación
- 153/153 tests + tsc limpio.
- Harness fake-cam: contornos fluyendo (9), FPS ~9, estado detecting (sin quad).
  `harness-f2b.png`.
- Re-test humano pendiente (misma URL): acta densa → auto <5s; carta normal →
  auto <2s; timeout solo toast.

## Prohibiciones respetadas
- Sin tocar Canny, core/, spike.html, tests/bench/. Sin budget de contornos
  (Fix 3 P4 no aplicado). Ventanas con origen citado.
