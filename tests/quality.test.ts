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
  SHUTTER_HOLD_MS,
  SHUTTER_SCORE,
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

describe('sharpness (Var Laplacian sobre crop 480p)', () => {
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
  it('muestras fuera de la ventana de 300ms se IGNORAN (backpressure)', () => {
    // t=500 está a 500ms de now=1000 → fuera; su quad salvaje no debe pesar.
    // Si se incluyera por índice, la varianza explotaría y el score caería.
    const history = [
      { t: 500, quad: Q(400, 300) },
      { t: 750, quad: Q() },
      { t: 800, quad: Q() },
      { t: 900, quad: Q() },
      { t: 1000, quad: Q() },
    ];
    expect(computeStabilityScore(history, 1000)).toBe(1.0);
    expect(STABILITY_WINDOW_MS).toBe(300);
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

describe('shutter (racha continua por timestamps)', () => {
  it('0.9 sostenido 310ms → true', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 200, score: 0.9 },
        { t: 310, score: 0.9 },
      ]),
    ).toBe(true);
    expect(SHUTTER_SCORE).toBe(0.8);
    expect(SHUTTER_HOLD_MS).toBe(300);
  });
  it('0.9 hace 200ms + 0.6 hace 150ms → false (racha rota)', () => {
    expect(
      shouldTriggerShutter([
        { t: 800, score: 0.9 },
        { t: 850, score: 0.6 },
      ]),
    ).toBe(false);
  });
  it('0.9 sostenido solo 250ms → false (no alcanzó los 300ms)', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.9 },
        { t: 100, score: 0.9 },
        { t: 250, score: 0.9 },
      ]),
    ).toBe(false);
  });
  it('fallo antiguo fuera de la ventana no contamina (semántica por tiempo)', () => {
    expect(
      shouldTriggerShutter([
        { t: 0, score: 0.5 },
        { t: 500, score: 0.9 },
        { t: 600, score: 0.9 },
        { t: 800, score: 0.9 },
      ]),
    ).toBe(true);
  });
  it('< 2 muestras → false', () => {
    expect(shouldTriggerShutter([])).toBe(false);
    expect(shouldTriggerShutter([{ t: 0, score: 0.95 }])).toBe(false);
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
  it('eccentricity numérica → throw (CANDIDATE sin aprobación humana)', () => {
    expect(() =>
      computeTotalScore(
        { sharpness: 1, exposure: 1, stability: 1, eccentricity: 0.9 },
        300,
      ),
    ).toThrow(/CANDIDATE/);
    expect(() => computeEccentricityScore(Q(), 640, 480)).toThrow(/CANDIDATE/);
  });
});

describe('timeout (escape a manual)', () => {
  it(`8001ms → true; 7999ms → false (umbral ${NO_DETECT_TIMEOUT_MS}, estricto >)`, () => {
    expect(detectionTimedOut(0, 8001)).toBe(true);
    expect(detectionTimedOut(0, 7999)).toBe(false);
    expect(detectionTimedOut(0, 8000)).toBe(false);
  });
});
