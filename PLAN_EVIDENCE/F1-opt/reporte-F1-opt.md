# Evidencia F1-opt P1 — RETR_EXTERNAL (palanca 1, pendiente validación humana)

Fecha: 2026-09-22 · Baseline Samsung: 12.3 portrait / 13.1 landscape (<15).

## Cambio (pipeline.ts + CvApi + adapter + test; Canny intacto 50/150)
- `findContours(..., RETR_EXTERNAL, ...)`: las arrugas/texturas del papel
  generan contornos internos que se aproximaban en vano; el borde del papel es
  exterior de su región. `RETR_LIST` queda en la interfaz (sin uso, compat).

## Regresión de fixtures (worker real, PRESERVE-50/150, `bench-retr-external.json`)
| fixture | RETR_LIST (F1) | RETR_EXTERNAL (P1) |
|---|---|---|
| a | ✓ 0.0033 | ✓ 0.0033 |
| b | ✗ (igual) | ✗ (igual — NO arreglado de contrabando) |
| c | ✓ 0.0020-0.0023 | ✓ 0.0023 |
| d | ✓ 0.0023 | ✓ 0.0023 |
| e | ✓ null | ✓ null |
| f | ✓ null | ✓ null |
- gtErr ≤0.004 en a/c/d ✓. ms ~10-13 (sin regresión de throughput sintético;
  el ms absoluto es ruidoso — la decisión la da el dispositivo, no este número).

## Estado: IMPLEMENTADA, NO VALIDADA
- Falta (humano, SM-A566E): FPS en ambas orientaciones con este build.
  ≥15 en la peor → PARAR y cerrar F1-opt. <15 → palanca 2 (cap 8 contornos).
  Si se agotan → D7 pre-aprobada (≥12 + frase de fluidez del humano).

## Prohibiciones respetadas
- Sin tocar geometry/quality/quadSelect/Canny/protocolo/corners/spike/bench.
