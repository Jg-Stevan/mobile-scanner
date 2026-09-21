// src/core/quality.ts — Score compuesto (PLAN_MAESTRO §8: compartido worker/benchmark).
//
// TODO (T3): QualityScorer con 4 métricas sobre el CROP del documento a resolución
// fija (nunca frame completo, §5-F2): Var(Laplacian) para nitidez, percentiles 5/95
// del histograma para exposición, varianza temporal de quads (ventana 300ms) para
// estabilidad, + penalizaciones de excentricidad y brillo especular (>2-3% píxeles >248).
// PROHIBIDO (AGENTS.md): definir umbrales aquí — se calibran con datos reales de
// captura y las constantes viven en src/core/ (T3). Sin implementación en T2.
export const QUALITY_TODO =
  'QualityScorer 4 métricas + pesos 0.4/0.3/0.3 — T3, PLAN_MAESTRO §5-F2' as const;