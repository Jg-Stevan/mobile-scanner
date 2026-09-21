# Evidencia T3 — src/core/quality.ts + tests

Fecha: 2026-09-21 · Precondición: T1-R4 cerrada (`74bfe79`), T2 en baseline.
Commit T3: ver `git log` (este reporte se commitea con el diff).

## Implementación (`src/core/quality.ts`, puro, sin DOM/OpenCV)
- 11 constantes exportadas con origen citado (WEIGHTS/SHARPNESS_NORM/BLUR/
  UNDER+OVER+SPECULAR_PX/WARN/STABILITY_VAR_NORM+WINDOW/SHUTTER_SCORE+HOLD/
  NO_DETECT_TIMEOUT + ECCENTRICITY_MARGIN candidata).
- 7 funciones: computeSharpnessScore, computeExposureScore
  ({score, specularRatio, specularWarn}), computeStabilityScore (ventana por
  timestamps; <2 → 0), computeEccentricityScore (BLOQUEADA, throw),
  computeTotalScore(parts, sharpnessVar, specularRatio=0), shouldTriggerShutter
  (racha final continua ≥300ms por timestamps, ≥2 muestras), detectionTimedOut
  (estricto > 8000).
- Contrato 480p documentado en cabecera + cada función.

## Decisiones documentadas (desviaciones del brief resueltas con criterio)
1. **Renormalización (brief: "(0.4/0.7, 0.3/0.7, 0.3/0.7)"):** inconsistente —
   Σ = 1/0.7 ≈ 1.43 rompería el contrato 0–1 y contradice "pesos exactos
   (0.4·s+0.3·e+0.3·st)" del mismo párrafo. Rige fórmula genérica
   Σ(wᵢ·vᵢ)/Σ(w presentes) = pesos exactos hoy (Σ=1.0), absorbe el futuro peso
   de excentricidad sin romper rango. Comentado en código; humano adjudica.
2. **isBlur "pasarla aparte":** firma `computeTotalScore(parts, sharpnessVar,
   specularRatio=0)` — la varianza cruda va en 2º parámetro.
3. **QualityScore (types.ts T2, NO modificado):** `eccentricity`=1 neutro
   mientras esté bloqueada; `specular`=ratio medido (viaja desde exposure).
4. **Eccentricity numérica en computeTotalScore → throw** (bloqueo CANDIDATE
   coherente con computeEccentricityScore). ECCENTRICITY_MARGIN=0.05 declarada
   pero SIN aprobar por el humano → sin efecto.

## Verificación
- `npm test`: 40/40 (21 quality nuevos + 19 geometry intactos).
- `npm run coverage`: quality.ts **100% líneas** (DoD ≥90%); geometry 94.69%.
- `npx tsc --noEmit`: limpio.
- Harness: `vite.config.ts` coverage.include += `src/core/quality.ts`
  (único cambio fuera de quality.ts/tests; geometry.ts intacto).

## Prohibiciones respetadas
- Sin tocar geometry.ts, worker, cámara, UI. Sin OpenCV/DOM en core/.
- tests/bench/ intacto. Excentricidad sin implementar (throw).
