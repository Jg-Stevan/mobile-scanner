// tests/quality.test.ts — QualityScorer + máquina de disparo (T3).
// PLAN_MAESTRO §5-F2. Todo sintético y determinista; umbrales desde las
// constantes de src/core/quality.ts (el test NO los duplica inline salvo para
// documentar la expectativa: SHARPNESS_NORM=300, BLUR=100, ventana 300ms,
// shutter 0.8/300ms, timeout 8000ms).
import { describe, expect, it } from 'vitest';

import type { Quadrilateral } from '../src/core/types';
import {
  BLUR_THRESHOLD,
  NO_DETECT_TIMEOUT_MS,
  SHARPNESS_NORM,
  SHUTTER_K,
  SHUTTER_N,
  SHUTTER_SCORE,
  SHUTTER_SPAN_MS,
  SPECULAR_RATIO_WARN,
  STABILITY_WINDOW_MS,
  computeEccentricityScore,
  computeExposureScore,
  computeSharpnessScore,
  computeStabilityScore,
  computeTotalScore,
  detectionTimedOut,
  shouldTriggerShutter,
} from '../src/core/quality';

const Q = (dx = 0, dy = 0): Quadrilateral => [
  { x: 100 + dx, y: 100 + dy },
  { x: 300 + dx, y: 100 + dy },
  { x: 300 + dx, y: 400 + dy },
  { x: 100 + dx, y: 400 + dy },
];

/** Histograma de 256 bins: `parts` = [bin, conteo]. */
function hist(parts: Array<[number, number]>): number[] {
  const h = new Array<number>(256).fill(0);
  for (const [bin, count] of parts) h[bin] = count;
  return h;
}

describe('sharpness (Var Laplacian sobre crop 400-clase)', () => {
  it(`var >= ${SHARPNESS_NORM} satura a 1.0`, () => {
    expect(computeSharpnessScore(300)).toBe(1.0);
    expect(computeSharpnessScore(600)).toBe(1.0);
  });
  it('var 150 → 0.5', () => {
    expect(computeSharpnessScore(150)).toBeCloseTo(0.5, 12);
  });
  it('var 0/negativa/NaN → 0 (clamp)', () => {
    expect(computeSharpnessScore(0)).toBe(0);
    expect(computeSharpnessScore(-10)).toBe(0);
    expect(computeSharpnessScore(NaN)).toBe(0);
  });
  it(`isBlur compara la VARIANZA cruda contra BLUR_THRESHOLD=${BLUR_THRESHOLD}`, () => {
    const base = { sharpness: 0.5, exposure: 1, stability: 1, eccentricity: null };
    expect(computeTotalScore(base, 99).isBlur).toBe(true);
    expect(computeTotalScore(base, 101).isBlur).toBe(false);
  });
});

describe('exposure (histograma 256 bins del crop)', () => {
  it('histograma perfecto (todo en bin 128) → 1.0 sin specular', () => {
    const r = computeExposureScore(hist([[128, 1000]]));
    expect(r.score).toBe(1.0);
    expect(r.specularRatio).toBe(0);
    expect(r.specularWarn).toBe(false);
  });
  it('10% de píxeles < 30 descuenta 0.1', () => {
    const r = computeExposureScore(hist([[10, 100], [128, 900]]));
    expect(r.score).toBeCloseTo(0.9, 12);
  });
  it(`5% especular → warn true; 2% → false (umbral ${SPECULAR_RATIO_WARN})`, () => {
    const warn = computeExposureScore(hist([[250, 50], [128, 950]]));
    expect(warn.specularRatio).toBeCloseTo(0.05, 12);
    expect(warn.specularWarn).toBe(true);
    const ok = computeExposureScore(hist([[250, 20], [128, 980]]));
    expect(ok.specularRatio).toBeCloseTo(0.02, 12);
    expect(ok.specularWarn).toBe(false);
  });
  it('histograma vacío → score 0 sin warn', () => {
    const r = computeExposureScore(new Array<number>(256).fill(0));
    expect(r).toEqual({ score: 0, specularRatio: 0, specularWarn: false });
  });
});

describe('stability (ventana TEMPORAL por timestamps — backpressure)', () => {
  it('1 sola muestra en ventana → 0', () => {
    expect(computeStabilityScore([{ t: 900, quad: Q() }], 1000)).toBe(0);
  });
  it('muestras fuera de la ventana de 600ms se IGNORAN (backpressure)', () => {
    // El test original metía la muestra salvaje 500ms antes (fuera de ventana
    // 300) para hundir el score si se colaba por índice. Con ventana 600 esa
    // muestra cae DENTRO, así que la empujamos a 600ms (400) para mantener la
    // intención: fuera de la ventana real → score intacto 1.0; el drift 400,300
    // daría ~20000 de varianza si se incluyera (hundiría a 0).
    const history = [
      { t: 400, quad: Q(400, 300) },
      { t: 900, quad: Q() },
      { t: 950, quad: Q() },
      { t: 980, quad: Q() },
      { t: 1000, quad: Q() },
    ];
    // 400 está a 600ms exactos (≤) → dentro; 300 sí estaría fuera: usamos 300
    const outside = [
      { t: 300, quad: Q(400, 300) },
      { t: 900, quad: Q() },
      { t: 950, quad: Q() },
      { t: 980, quad: Q() },
      { t: 1000, quad: Q() },
    ];
    expect(computeStabilityScore(history, 1000)).toBeCloseTo(0, 6); // dentro → hunde
    expect(computeStabilityScore(outside, 1000)).toBe(1.0); // fuera → intacto
    expect(STABILITY_WINDOW_MS).toBe(600);
  });
  it('jitter conocido → 1 − meanVar/20 exacto (offset 10px en x, 2 muestras)', () => {
    // Varianza por coordenada x: ((−5)² + 5²)/2 = 25 en 4 esquinas;
    // meanVar = (4·25 + 0)/8 = 12.5 → score = 1 − 12.5/20 = 0.375.
    const s = computeStabilityScore(
      [{ t: 900, quad: Q() }, { t: 1000, quad: Q(10, 0) }],
      1000,
    );
    expect(s).toBeCloseTo(0.375, 12);
  });
  it('muestras futuras (t > now) se ignoran', () => {
    expect(
      computeStabilityScore([{ t: 1100, quad: Q() }, { t: 1200, quad: Q() }], 1000),
    ).toBe(0);
  });
});

describe('shutter k-de-n (APROBADA por humano 2026-09-22 F2-c: 4 de 6 en 1200ms, última buena)', () => {
  it('0,345,690,1035 todas 0.9 → true en t=1035 (acta a 2.9 FPS, ~1s)', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 345, score: 0.9 },
        { t: 690, score: 0.9 },
        { t: 1035, score: 0.9 },
      ]),
    ).toBe(true);
    expect(SHUTTER_K).toBe(4);
    expect(SHUTTER_N).toBe(6);
    expect(SHUTTER_SPAN_MS).toBe(1200);
    expect(SHUTTER_SCORE).toBe(0.8);
  });
  it('6 muestras 0.9 a 300ms → true (6/6)', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 300, score: 0.9 },
        { t: 600, score: 0.9 },
        { t: 900, score: 0.9 },
        { t: 1200, score: 0.9 },
        { t: 1500, score: 0.9 },
      ]),
    ).toBe(true);
  });
  it('intercaladas: 4 buenas de 6 con última buena → true (tolerancia F2-c)', () => {
    // F2-b exigía racha continua 500ms → false; F2-c tolera 2 caídas → true
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 200, score: 0.5 },
        { t: 300, score: 0.9 },
        { t: 400, score: 0.5 },
        { t: 500, score: 0.9 },
      ]),
    ).toBe(true);
  });
  it('3 buenas de 6 (última buena) → false', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.5 },
        { t: 200, score: 0.5 },
        { t: 300, score: 0.9 },
        { t: 400, score: 0.5 },
        { t: 500, score: 0.9 },
      ]),
    ).toBe(false);
  });
  it('última ≤0.8 → false aun con 5 buenas antes', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 200, score: 0.9 },
        { t: 300, score: 0.9 },
        { t: 400, score: 0.9 },
        { t: 500, score: 0.5 },
      ]),
    ).toBe(false);
  });
  it('muestras fuera del span (>1200ms) no cuentan', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 200, score: 0.9 },
        { t: 300, score: 0.9 },
        { t: 1400, score: 0.9 },
        { t: 1500, score: 0.9 },
      ]),
    ).toBe(false);
  });
  it('< 4 muestras → false', () => {
    expect(shouldTriggerShutter([])).toBe(false);
    expect(shouldTriggerShutter([{ t: 0, score: 0.95 }])).toBe(false);
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 200, score: 0.9 },
      ]),
    ).toBe(false);
  });
  it('excentricidad 0.3 sostenida → sigue sin disparar (total 0.3 < 0.8)', () => {
    const t = new Float32Array([0.0, 0.2, 0.9, 0.2, 0.9, 0.8, 0.0, 0.8]);
    void t;
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.3 },
        { t: 345, score: 0.3 },
        { t: 690, score: 0.3 },
        { t: 1035, score: 0.3 },
      ]),
    ).toBe(false);
  });
});

describe('total (pesos 0.4/0.3/0.3 + renormalización)', () => {
  it('pesos exactos: 0.4·s + 0.3·e + 0.3·st', () => {
    const q = computeTotalScore(
      { sharpness: 0.5, exposure: 1.0, stability: 0.0, eccentricity: null },
      150,
    );
    expect(q.total).toBeCloseTo(0.4 * 0.5 + 0.3 * 1.0 + 0.3 * 0.0, 12);
    expect(q.total).toBeCloseTo(0.5, 12);
  });
  it('eccentricity null/omitida → mismos pesos (Σ presentes = 1.0)', () => {
    const parts = { sharpness: 0.8, exposure: 0.6, stability: 0.4 };
    const q = computeTotalScore(parts, 200);
    expect(q.total).toBeCloseTo(0.4 * 0.8 + 0.3 * 0.6 + 0.3 * 0.4, 12);
    expect(q.eccentricity).toBe(1); // neutro mientras esté bloqueada
  });

  describe('eccentricity (APROBADA humano 2026-09-21, T3-b)', () => {
    // Frame 640×480 → lado corto 480 → margin = 0.05·480 = 24px.
    const W = 640;
    const H = 480;
  it('quad centrado (esquinas ≥ 24px del borde) → 1.0', () => {
    const q: Quadrilateral = [
      { x: 100, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBe(1.0);
  });
  it('esquina a exactamente margin (24px) → 1.0 (frontera)', () => {
    const q: Quadrilateral = [
      { x: 24, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBeCloseTo(1.0, 12);
  });
  it('esquina a mitad de margin (12px) → 0.5', () => {
    const q: Quadrilateral = [
      { x: 12, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBeCloseTo(0.5, 12);
  });
  it('esquina sobre el borde (x=0) → 0.0', () => {
    const q: Quadrilateral = [
      { x: 0, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBe(0.0);
  });
  it('esquina fuera del frame (x=-10) → 0.0 (clamp)', () => {
    const q: Quadrilateral = [
      { x: -10, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 380 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBe(0.0);
  });
  it('UNA sola esquina cerca del borde → domina la peor', () => {
    // Tres esquinas a 100px+, una a 6px → 6/24 = 0.25.
    const q: Quadrilateral = [
      { x: 100, y: 100 },
      { x: 540, y: 100 },
      { x: 540, y: 380 },
      { x: 100, y: 6 },
    ];
    expect(computeEccentricityScore(q, W, H)).toBeCloseTo(0.25, 12);
  });
  it('frame inválido (lado ≤ 0) → 0 sin romper', () => {
    expect(computeEccentricityScore(Q(), 0, 480)).toBe(0);
    expect(computeEccentricityScore(Q(), 640, -1)).toBe(0);
  });
  it('integración multiplicativa: base 1.0 × ecc 0.5 → 0.5; null → 1.0; 1 → 1.0', () => {
    const base = { sharpness: 1, exposure: 1, stability: 1 };
    const penalized = computeTotalScore({ ...base, eccentricity: 0.5 }, 300);
    expect(penalized.total).toBeCloseTo(0.5, 12);
    expect(penalized.eccentricity).toBe(0.5);
    expect(computeTotalScore({ ...base, eccentricity: null }, 300).total).toBeCloseTo(
      1.0,
      12,
    );
    const neutral = computeTotalScore({ ...base, eccentricity: 1 }, 300);
    expect(neutral.total).toBeCloseTo(1.0, 12);
    expect(neutral.eccentricity).toBe(1);
  });
  it('eccentricity 0.3 sostenida impide el disparo aunque sharpness/exposure/stability sean altas', () => {
    // base perfecta 1.0 × 0.3 = 0.3 < 0.8 → la racha nunca supera el umbral.
    const total = computeTotalScore(
      { sharpness: 1, exposure: 1, stability: 1, eccentricity: 0.3 },
      300,
    ).total;
    expect(total).toBeCloseTo(0.3, 12);
    expect(
      shouldTriggerShutter([
        { t: 0, score: total },
        { t: 100, score: total },
        { t: 200, score: total },
        { t: 400, score: total },
      ]),
    ).toBe(false);
  });

});

});

describe('timeout (escape a manual)', () => {
  it(`8001ms → true; 7999ms → false (umbral ${NO_DETECT_TIMEOUT_MS}, estricto >)`, () => {
    expect(detectionTimedOut(0, 8001)).toBe(true);
    expect(detectionTimedOut(0, 7999)).toBe(false);
    expect(detectionTimedOut(0, 8000)).toBe(false);
  });
});
