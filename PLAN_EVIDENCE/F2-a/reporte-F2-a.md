# Evidencia F2-a — Correctiva "documento denso" (Fix 1+2; P4 sin aprobar)

Fecha: 2026-09-22 · Precondición: F2 en baseline (`54e3171`).
Contexto: acta electoral densa (SM-A566E): FPS 3.1, falso "Muy oscuro",
ecc ~0.69. Desglose externo verificado: 0.865 × 0.69 ≈ 0.60.

## Fix 1 — sampler de exposición sobre el crop del quad
- `ScanOrchestrator.sampleExposure` (default): bbox del quad actual + 5% margen
  (lastCorners se actualiza ANTES de muestrear — sin lag); sin quad → frame.
  Solo el default cambia (deps inyectadas intactas).
- Test: drawImage full-frame sin quad; crop [32,24,576,432] con quad .1-.9.
- 152/152 + tsc.

## Fix 2 — diag contourCount (dato, no teoría)
- `protocol.ts`: `RawQualityInput.diag?: { contourCount }` (ADITIVO, opcional).
- `pipeline.ts`: `diag: { contourCount: n }` (mismo n del loop detector).
- Test pipeline: diag presente con 1 contorno.
- Harness F2-device: métrica "Contornos" en vivo — verificado: fake cam
  muestra `2` fluyendo (worker→protocolo→frameLoop→UI). `harness-contornos.png`.
- Redeploy /f1… no: **/f2/** reconstruido con ambos fixes (bundles verificados:
  crop en sampler + `diag.contourCount` en métricas + contourCount en worker).

## Fix 3 (P4 300px) — NO APLICADO (falta OK explícito del humano).

## Re-test humano pendiente (misma URL mode=camera)
1. Acta ALEJANDO el teléfono (margen visible) → debe disparar (Fix 1 + ecc).
2. Leer **contourCount** en el acta densa → número real → palanca FPS con dato.
3. Carta normal con texto → disparar <2s (validación Fase-0 de umbrales).

## Prohibiciones respetadas
- Sin budget de contornos, sin tocar quality.ts/Canny/core/spike/bench.
- pipeline": solo línea diag (spec lo autoriza como aditivo).
