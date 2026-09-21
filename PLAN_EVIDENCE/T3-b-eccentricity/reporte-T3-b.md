# Evidencia T3-b — Excentricidad aprobada e implementada

Fecha: 2026-09-21 · Precondición: T3 en baseline (`2d806ab`).

## Aprobación humana (registrada también en WORKFLOW_STATE → Decisiones)
- ECCENTRICITY_MARGIN = 0.05 del lado corto del frame; score por esquina =
  clamp(dMin/margin, 0, 1); final = mín de las 4 (peor domina).
- Integración: PENALIZACIÓN MULTIPLICATIVA `total = base × (ecc ?? 1)`
  (la fórmula §5-F2 congelada queda intacta; el shutter la hereda vía total).

## Cambios (solo `src/core/quality.ts` + `tests/quality.test.ts`)
- Constante: comentario CANDIDATE → APROBADA (valor 0.05 sin cambio).
- `computeEccentricityScore`: cuerpo implementado (antes throw). Guard de frame
  inválido → 0. Fuera del frame → dMin negativa → clamp 0.
- `computeTotalScore`: eliminado el throw con eccentricity numérica;
  `eccentricity` del resultado = valor recibido (1 si null/undefined).
- Tests: el `it` que esperaba throw → describe nuevo con 9 casos (centrado 1.0,
  frontera 24px → 1.0, mitad → 0.5, borde → 0, fuera → 0, peor domina 0.25,
  frame inválido, integración ×0.5/null/1, shutter bloqueado con ecc 0.3).

## Verificación
- `npm test`: 48/48 (29 quality + 19 geometry intactos).
- `npm run coverage`: quality.ts **100% líneas** (DoD ≥95%).
- `npx tsc --noEmit`: limpio.

## Prohibiciones respetadas
- Sin tocar geometry.ts, worker, cámara, UI. Fórmula base 0.4/0.3/0.3 intacta.
- ECCENTRICITY_MARGIN sin cambio de valor. Sin campos nuevos en types.ts
  (el aviso "centra el documento" se derivará en UI F2 desde eccentricity < 1).
