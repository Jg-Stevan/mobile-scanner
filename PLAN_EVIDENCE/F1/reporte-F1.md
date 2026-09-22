# Evidencia F1 — QuadDetector real + overlay en vivo

Fecha: 2026-09-22 · Precondición: T6 en baseline (`3d51505`).

## Fase 0 — Benchmark de dimensiones (decisión con datos, backlog pagado)
- Fixtures: `scripts/gen-fixtures.mjs` (sin deps, PRNG determinista) → 6 PNG
  360×640 + `gt.json` en `tests/fixtures/` (semilla del sistema de evaluación F4).
- Método: worker real + OpenCV 4.5.5, 6 fixtures × {SQUASH 640×480, PRESERVE
  270×480} × {Canny 50/150, 75/200}. Métrica: pass/fail + corner err en
  fracciones (invariante de escala) + ms. `bench-fase0.json` + `bench-fase0.png`.
- Resultado: a✓ c✓ d✓ e✓(null) f✓(null) en LAS 4 configs; **b (fondo claro)
  falla en las 4** (bajo contraste — trabajo futuro F6.5/CLAHE, fuera de F1).
- **DECISIÓN: PRESERVE** (empate en detección → regla del spec; ~35% menos px).
  **CANNY 50/150** (empate en detección; costo manda: ~10ms vs segundos en
  ruido con RETR_LIST — el 75/200 fragmenta contornos y el loop por contorno
  se~dispara). Constantes `CANNY_LOW/HIGH` con origen citado.
- Observación honesta: los ms absolutos son ruidosos (±GC/contención); la
  comparación relativa intra-run es la válida (50/150 ≤ 75/200 en los 6).

## Fase 1 — QuadDetector (pipeline + `src/core/quadSelect.ts` nuevo)
- `selectQuad`: top-5 por área → 4 vértices → orderPoints + validateQuad
  (consumo, sin editar geometry.ts). `scalePoly` para proceso→original.
- pipeline: contornos → approxPolyDP(0.02·peri) → quads en px ORIGINALES →
  corners Float32Array(8) en fracciones + stats del CROP del quad
  (laplacianVar/cropMean/cropStdDev, contrato quality.ts) o frame si null.
- `computeProcessDims` (protocol.ts) + `resizeMode` en frameLoop
  ('preserve' default; onResult gana corners como 3er parámetro aditivo).

## Fase 2 — Overlay (`src/ui/ScannerView.ts`)
- contain + nativo↔display (port del spike) + verde/rojo + hint D2
  ("Gira el teléfono en vertical" si quad alto + landscape). Sin suavizado
  (prohibido sin espec UX). Unit: matemática + render mock + D2.

## Fase 3 — Vivo + estrés (fuente sintética canvas.captureStream, GT conocido)
- Live 30s (`live-30s.json` + `live-overlay.png`): 438 resultados, 14.6 FPS,
  latencia overlay avg 42.9 / p95 90.8ms (<100 ✓), gtErr 0.0024, D2 visible
  438/438, heap −27%.
- **Estrés 10 min** (`stress-10min.json`, DoD diferido de T4 PAGADO): 8594
  resultados (13.9 FPS sostenidos), heap 2.36→1.99MB **−15.8%** sin tendencia
  (sierra de GC 2-2.9MB, plano), gtErr 0.0024 estable, sent 8595/dropped 8363
  (backpressure por diseño).

## ⏳ PENDIENTE HUMANO (división AGENTS.md — no bloquea el código)
- SM-A566E: harness en pantalla, carta sobre mesa oscura → polígono verde,
  ≥15 FPS, <100ms. Screenshot → completar evidencia.
- iPhone 17 Pro: misma prueba (DoD del plan exige ambos).
- Menor: toggle torch real en iOS (viene de T6).

## Prohibiciones respetadas
- Sin score/shutter en worker (solo crudos). Sin editar geometry.ts/quality.ts
  (quadSelect.ts es archivo NUEVO que los consume). Sin setInterval (rAF +
  setTimeout encadenados, también en harnesses). Sin tocar spike.html,
  tests/bench/ (fixtures en tests/fixtures/, no en bench/).
