# Evidencia F2-c — Criterio k-de-n de disparo + timeout sin vibrar + flash iOS

Fecha: 2026-09-22 · Precondición: F2-b en baseline (`0d557a1`).

## Implementación (solo `src/core/quality.ts` + `src/scan/ScanOrchestrator.ts`, sin tocar aprobados)
- `quality.ts` (puro): criterio k-de-n `shouldTriggerShutter` — true si entre
  las últimas N=6 muestras dentro de SPAN=1200ms hay al menos K=4 con score >
  SHUTTER_SCORE (0.8) Y la última muestra es buena. Tolera hasta N−K=2 caídas
  puntuales de autofocus/exposición (evidencia: video F2-b, score 92-95
  sostenido 9s sin disparar). Reemplaza la racha continua 600ms de F2-b.
  `SHUTTER_HOLD_MS` se conserva como `@deprecated` porque el
  benchmark/tests históricos lo referencian (sin cambio lógico).
- `ScanOrchestrator.ts`: retención de `scoreHistory` a SHUTTER_SPAN_MS+200 =
  1400ms (cubre el SPAN completo más una muestra de guarda).
- Timeout sin vibrar: `notify('timeout')` → `'none'` (vibración SOLO en
  captura — antes vibraba también en timeout cada 8s → indistinguible;
  el toast ya avisa). Sin vibración disponible (iOS) → la UI flashea el
  overlay. Flash iOS restaurado en el harness.
- Desbloqueo del caso acta densa: a 3.1 FPS la racha 600ms era imposible
  (muestras cada ~345ms); con k-de-n el auto dispara en <5s.

## Verificación
- Unit: 156/156 (k-de-n: última-mala no dispara, <4 muestras no dispara,
  caídas puntuales toleradas, excentricidad 0.3 sostenida no dispara +
  regresión total del módulo). tsc limpio.
- Cobertura: quality.ts 100% líneas (heredado T3/T3-b, sin nuevas ramas
  sin cubrir).

## ⏳ PENDIENTE HUMANO (acta densa + documento normal)
- Re-test en dispositivo: ¿auto dispara <5s con acta densa? ¿sin disparo
  espurio con documento normal al mover? ¿timeout = solo toast (sin
  vibración) y captura = vibra/flash?
- Screenshots → completar esta evidencia.

## Prohibiciones respetadas
- Sin warp/recorte (cruda + prior). Constantes y umbrales intactos
  (SHUTTER_SCORE 0.8, K=4/N=6/SPAN=1200ms aprobados por humano 2026-09-22).
  Sin tocar core/ más allá de quality.ts, spike.html, tests/bench/,
  pipeline, PLAN_MAESTRO.md. Sin setInterval.
