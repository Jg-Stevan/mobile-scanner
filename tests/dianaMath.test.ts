// tests/dianaMath.test.ts — medición de la diana F4 (orden F4 punto 4).
// Matemática pura: px→mm con el ancho real medido + percentil 95.
import { describe, expect, it } from 'vitest';

import {
  DIANA_DEFAULT_WIDTH_MM,
  cdeReport,
  cornerResidualsMm,
  meanWidthPx,
  mmPerPixel,
  percentile95,
  sideLengths,
} from '../src/core/dianaMath';
import type { Quadrilateral } from '../src/core/types';

function quad(c: Array<[number, number]>): Quadrilateral {
  return c.map(([x, y]) => ({ x, y })) as Quadrilateral;
}

// Rectángulo "diana" a escala: 100×50 px → mmPorPx = ancho real / 100.
const DIANA = quad([
  [0, 0],
  [100, 0],
  [100, 50],
  [0, 50],
]);

describe('F4 diana: geometría y escala', () => {
  it('ancho nominal por defecto de la diana', () => {
    expect(DIANA_DEFAULT_WIDTH_MM).toBe(190.5);
  });
  it('sideLengths: [top, right, bottom, left]', () => {
    expect(sideLengths(DIANA)).toEqual([100, 50, 100, 50]);
  });
  it('meanWidthPx: media de lados top/bottom', () => {
    expect(meanWidthPx(DIANA)).toBe(100);
  });
  it('mmPerPixel: ancho real 190.5 mm sobre el ancho medido', () => {
    expect(mmPerPixel(100, 190.5)).toBeCloseTo(1.905, 5);
  });
  it('mmPerPixel: 190.5 mm y 185 mm son proporcionales al ancho real', () => {
    const errorPx = 0.5;
    const errorAt190_5 = errorPx * mmPerPixel(100, 190.5);
    const errorAt185 = errorPx * mmPerPixel(100, 185);
    expect(errorAt190_5).toBeCloseTo(0.9525, 5);
    expect(errorAt185).toBeCloseTo(0.925, 5);
    expect(errorAt185 / errorAt190_5).toBeCloseTo(185 / 190.5, 8);
  });
  it('mmPerPixel degenerado (ancho 0) → NaN', () => {
    const degen = quad([
      [0, 0],
      [0, 0],
      [0, 10],
      [0, 10],
    ]);
    expect(Number.isNaN(mmPerPixel(meanWidthPx(degen), 190.5))).toBe(true);
  });
});

describe('F4 diana: residuos esquina↔media (CDE)', () => {
  it('<2 capturas → null (una captura no define media)', () => {
    expect(cornerResidualsMm([DIANA], 190.5)).toBeNull();
    expect(cornerResidualsMm([], 190.5)).toBeNull();
  });
  it('2 capturas con 1px de offset en la esquina TL → residuo 0.5px escalado en mm', () => {
    const shifted = quad([
      [1, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
    const res = cornerResidualsMm([DIANA, shifted], 190.5)!;
    expect(res).toHaveLength(8); // 4 esquinas × 2 capturas
    // Cada captura escala con SU PROPIO mm/px (el ancho medido también tiene
    // jitter: la captura desplazada mide top=99 → mm2 algo mayor que mm1).
    const mm1 = 190.5 / 100; // captura sin jitter: 1.905
    const mm2 = 190.5 / 99.5; // captura 1px: 1.91457…
    // captura 1: esquina TL media (0.5,0) → 0.5px; resto 0
    expect(res[0]).toBeCloseTo(0.5 * mm1, 5);
    expect(res[1]).toBeCloseTo(0, 5);
    expect(res[2]).toBeCloseTo(0, 5);
    expect(res[3]).toBeCloseTo(0, 5);
    // captura 2: TL a 0.5px de la media (escala de ESTA captura); resto 0
    expect(res[4]).toBeCloseTo(0.5 * mm2, 5);
    expect(res[5]).toBeCloseTo(0, 5);
    expect(res[6]).toBeCloseTo(0, 5);
    expect(res[7]).toBeCloseTo(0, 5);
  });
  it('quad degenerado en alguna captura → null (sin escala fiable)', () => {
    const degen = quad([
      [0, 0],
      [0, 0],
      [0, 10],
      [0, 10],
    ]);
    expect(cornerResidualsMm([DIANA, degen], 190.5)).toBeNull();
  });
});

describe('F4 diana: percentil 95 e informe CDE', () => {
  it('percentile95: interpolación en el rango [1..100] → 95.05 (R-7)', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile95(v)).toBeCloseTo(95.05, 5);
  });
  it('percentile95: 1 elemento → el propio valor; vacío → null', () => {
    expect(percentile95([42])).toBe(42);
    expect(percentile95([])).toBeNull();
  });
  it('cdeReport: count, mmPorPx medio y "±X mm al 95%"', () => {
    const shifted = quad([
      [1, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ]);
    const r = cdeReport([DIANA, shifted], 190.5)!;
    expect(r.count).toBe(2);
    const mm1 = 190.5 / 100;
    const mm2 = 190.5 / 99.5;
    expect(r.mmPerPixel).toBeCloseTo((mm1 + mm2) / 2, 5);
    // 8 residuos: seis 0 + e1 (0.5·mm1) + e2 (0.5·mm2) → p95 (rango 6.65)
    const e1 = 0.5 * mm1;
    const e2 = 0.5 * mm2;
    expect(r.p95mm).toBeCloseTo(e1 * 0.35 + e2 * 0.65, 4);
  });
  it('cdeReport: <2 capturas o degenerado → null', () => {
    expect(cdeReport([DIANA], 190.5)).toBeNull();
    const degen = quad([
      [0, 0],
      [0, 0],
      [0, 10],
      [0, 10],
    ]);
    expect(cdeReport([DIANA, degen], 190.5)).toBeNull();
  });
});