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

## Estado: P1 sin efecto → P2 implementada (pendiente validación humana)

## P2 — Cap 8 contornos (MAX_CONTOUR_CANDIDATES, origen citado)
- Cambio: two-pass (área de todos → sort → approx solo top-8). Unit: 10
  contornos → 8 approx + el mayor sigue ganando. 125/125 tests + tsc.
- Regresión (`bench-cap8.json`, worker real): a✓0.0033 c✓0.0023 d✓0.0023
  e✓f✓ + b✗ intacto. Idéntica a P1 (el cap no cambia lo detectado).
- Redeploy /f1/ con P2 (bundle verificado: `slice(0,8)` presente).

## Adjudicación /ship (revisor APROBADO vs revisor-b 1 finding)
- Finding ("PLAN_EVIDENCE/ prohibida"): DESESTIMADO. Todos los specs (T1-R4…
  F1-opt) MANDAN "Evidencia → PLAN_EVIDENCE/…"; 10 tareas cerraron así con doble
  aprobado. La línea AGENTS.md es ambigua, pero la práctica ratificada por el
  humano es escritura de reportes ahí (la prohibición real es tests/bench/
  como set de evaluación). Propuesta al humano: aclarar la línea a
  "PLAN_EVIDENCE/ (solo escritura de reportes)".
- Veredicto final: APROBADO.

## P3 — Reducción 480→400 (PROCESS_LONG_SIDE, origen citado en protocol.ts)
- Regresión (`bench-400.json`, 225×400): a✓0.0026 c✓0.0042 d✓0.0034 e✓f✓ +
  b✗ intacto. TODO ≤0.005 ✓ (c/d suben vs 0.0023 — pérdida documentada como
  insumo de calibración del CornerRefiner F3, no bloquea).
- E2E sintético (`live-400.json`, escena GT): **29.4 FPS desktop** (vs 14.6 a
  480p — escala 2× con píxeles, confirma el diagnóstico), gtErr 0.0027
  intacto, latencia p95 21ms, captureErrors 0.
- Redeploy /f1/ con P3 (bundle verificado: `400/Math.max`).

## Medición pendiente (humano, SM-A566E, misma URL mode=camera)
- P2: FPS portrait + landscape. Δ ≥ +1 y ≥15 → cerrar F1-opt. Δ < +1 → P3
  inmediato (PROCESS_LONG_SIDE 480→400). Agotadas sin ≥15 → D7 (si ≥12).

## Prohibiciones respetadas
- Sin tocar geometry/quality/quadSelect/Canny/protocolo/corners/spike/bench.
