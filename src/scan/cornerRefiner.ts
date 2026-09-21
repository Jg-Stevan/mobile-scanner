// src/scan/cornerRefiner.ts — refinado fino de esquinas (PLAN_MAESTRO §5-F3).
//
// TODO (F3): bandas adaptativas max(BAND_MIN_PX=30, 1.5% del lado) del blindaje 1,
// ajuste robusto con rechazo de outliers (RANSAC) sobre el crop, exclusión del
// 12% extremo de cada lado (TRIM_FRACTION, blindaje 2), y reutilización de la
// validación/fallback del blindaje 3 vía src/core/geometry.ts:
// fitLineTrimmed + refineQuadFromLines (fallback a esquina 480p por lado + flag).
// Sin implementación en T2.
export const CORNER_REFINER_TODO =
  'bandas adaptativas + RANSAC + blindaje 3 — F3, PLAN_MAESTRO §5-F3' as const;