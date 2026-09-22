// tests/scoring.test.ts — medición pura + cadena de avisos (F2).
import { describe, expect, it } from 'vitest';

import {
  HINT_BRIGHT,
  HINT_CENTER,
  HINT_DARK,
  HINT_GLARE,
  HINT_HOLD,
  HINT_NO_QUAD,
  laplacianVarGray,
  measureFrame,
  rgbaToGray,
  rgbaToHist,
  selectHint,
  underOverRatios,
} from '../src/scan/scoring';

/** Tablero w×h con valor fn(x,y) en RGBA. */
function board(w: number, h: number, fn: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(fn(x, y))));
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: w, height: h, data } as ImageData;
}

const sharp = (x: number, y: number): number => ((x + y) % 2 === 0 ? 0 : 255);
const flat = (): number => 128;

describe('medición', () => {
  it('tablero nítido >> plano (0); blur intermedio en medio', () => {
    const s = board(16, 16, sharp);
    const f = board(16, 16, flat);
    const lvS = laplacianVarGray(rgbaToGray(s.data), 16, 16);
    const lvF = laplacianVarGray(rgbaToGray(f.data), 16, 16);
    expect(lvS).toBeGreaterThan(10000);
    expect(lvF).toBe(0);
    // blur de caja 3×3 sobre el tablero → cae pero no a cero
    const blurred = board(16, 16, (x, y) => {
      let acc = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) acc += sharp(x + dx, y + dy);
      }
      return acc / 9;
    });
    const lvB = laplacianVarGray(rgbaToGray(blurred.data), 16, 16);
    expect(lvB).toBeGreaterThan(0);
    expect(lvB).toBeLessThan(lvS);
  });
  it('dims <3 o buffer corto → 0 sin romper', () => {
    expect(laplacianVarGray(new Uint8ClampedArray(4), 2, 2)).toBe(0);
    expect(laplacianVarGray(new Uint8ClampedArray(0), 10, 10)).toBe(0);
  });
  it('histograma cuenta 256 bins; measureFrame combina', () => {
    const h = rgbaToHist(board(4, 4, flat).data);
    expect(h[128]).toBe(16);
    expect(h.reduce((a, b) => a + b, 0)).toBe(16);
    const m = measureFrame(board(16, 16, sharp));
    expect(m.hist.length).toBe(256);
    expect(m.laplacianVar).toBeGreaterThan(0);
  });
  it('under/over con bandas de quality.ts (<30, >225)', () => {
    const h = new Array<number>(256).fill(0);
    h[10] = 30;
    h[250] = 20;
    h[128] = 50;
    expect(underOverRatios(h)).toEqual({ under: 0.3, over: 0.2 });
    expect(underOverRatios(new Array<number>(256).fill(0))).toEqual({ under: 0, over: 0 });
  });
});

describe('selectHint (un mensaje, por prioridad)', () => {
  const good = {
    hasQuad: true,
    eccentricity: 1,
    specularWarn: false,
    underRatio: 0,
    overRatio: 0,
    stability: 1,
  };
  it('todo bien → null', () => {
    expect(selectHint(good)).toBeNull();
  });
  it('cadena: no-quad > centrar > reflejo > claro > oscuro > firme', () => {
    expect(selectHint({ ...good, hasQuad: false, eccentricity: 0.2, specularWarn: true })).toBe(
      HINT_NO_QUAD,
    );
    expect(selectHint({ ...good, eccentricity: 0.5, specularWarn: true })).toBe(HINT_CENTER);
    expect(selectHint({ ...good, specularWarn: true, overRatio: 0.9 })).toBe(HINT_GLARE);
    expect(selectHint({ ...good, overRatio: 0.5, underRatio: 0.5 })).toBe(HINT_BRIGHT);
    expect(selectHint({ ...good, underRatio: 0.5 })).toBe(HINT_DARK);
    expect(selectHint({ ...good, stability: 0.9 })).toBe(HINT_HOLD);
  });
  it('fronteras de copy 0.25 (estricto >)', () => {
    expect(selectHint({ ...good, overRatio: 0.25 })).toBeNull();
    expect(selectHint({ ...good, underRatio: 0.25 })).toBeNull();
  });
});
