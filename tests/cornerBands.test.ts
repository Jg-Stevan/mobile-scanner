// tests/cornerBands.test.ts — bandas adaptativas del refiner (F3-b · §F3 blindaje 1).
// Puro Node: anchos 1.5% vs mínimo 30px, clamp a foto, degenerado → vacío.
import { describe, expect, it } from 'vitest';

import type { Quadrilateral } from '../src/core/types';
import { BAND_MIN_PX, BAND_PCT_OF_SIDE } from '../src/core/geometry';
import { computeBandRects } from '../src/core/cornerBands';

function rect(w: number, h: number, ox = 0, oy = 0): Quadrilateral {
  return [
    { x: ox, y: oy },
    { x: ox + w, y: oy },
    { x: ox + w, y: oy + h },
    { x: ox, y: oy + h },
  ];
}

describe('computeBandRects (blindaje 1)', () => {
  it('usa las constantes de banda de geometry (30px / 1.5%)', () => {
    expect(BAND_MIN_PX).toBe(30);
    expect(BAND_PCT_OF_SIDE).toBe(0.015);
  });
  it('lado largo 3000px → banda 45px (manda el 1.5%)', () => {
    const bands = computeBandRects(rect(3000, 4000), 3000, 4000);
    expect(bands).toHaveLength(4);
    expect(bands.map((b) => b.side)).toEqual([0, 1, 2, 3]);
    expect(bands[0]!.bandW).toBeCloseTo(45, 9);
    expect(bands[1]!.bandW).toBeCloseTo(60, 9); // 1.5% de 4000
  });
  it('quad 100×100 → banda mínima 30px (manda el mínimo)', () => {
    const bands = computeBandRects(rect(100, 100, 500, 500), 3000, 4000);
    expect(bands).toHaveLength(4);
    for (const b of bands) expect(b.bandW).toBe(30);
    // bbox del top inflada ±15: x 485..615, y 485..515
    expect(bands[0]).toMatchObject({ x: 485, y: 485, width: 130, height: 30 });
  });
  it('clamp a la foto: quad pegado al borde no sale de [0,W]×[0,H]', () => {
    const bands = computeBandRects(rect(3000, 4000, 0, 0), 3000, 4000);
    expect(bands).toHaveLength(4);
    for (const b of bands) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(3000);
      expect(b.y + b.height).toBeLessThanOrEqual(4000);
      expect(b.width).toBeGreaterThanOrEqual(1);
      expect(b.height).toBeGreaterThanOrEqual(1);
    }
  });
  it('lado colapsado (longitud 0) → sin banda para ese lado', () => {
    const q: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 0, y: 0 }, // top degenerado
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    const bands = computeBandRects(q, 1000, 1000);
    expect(bands.map((b) => b.side).sort()).toEqual([1, 2, 3]);
  });
  it('quad degenerado (todo el mismo punto / NaN) → []', () => {
    const pt: Quadrilateral = [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ];
    expect(computeBandRects(pt, 1000, 1000)).toEqual([]);
    const nan: Quadrilateral = [
      { x: NaN, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(computeBandRects(nan, 1000, 1000)).toEqual([]);
  });
  it('dims de foto inválidas → [] sin lanzar', () => {
    expect(computeBandRects(rect(100, 100), 0, 100)).toEqual([]);
    expect(computeBandRects(rect(100, 100), NaN, 100)).toEqual([]);
  });
});
