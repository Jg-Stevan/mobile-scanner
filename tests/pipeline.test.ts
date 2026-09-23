// tests/pipeline.test.ts — processFrame con cv mockeado (sin WASM).
// Verifica: detección real (contornos→approx→selectQuad del core), fracciones
// del frame ORIGINAL, stats del crop, y creados == destruidos con y sin
// excepción. qualityInput ahora lleva laplacianVar + cropMean/cropStdDev.
import { describe, expect, it } from 'vitest';

import type {
  CvApi,
  PipelineMat,
  PipelineMatVector,
  PipelineRect,
  PipelineSize,
} from '../src/workers/pipeline';
import type { Quadrilateral } from '../src/core/types';
import { computeBandRects } from '../src/core/cornerBands';
import { UNSHARP_AMOUNT, UNSHARP_KERNEL_SIZE, UNSHARP_RADIUS } from '../src/core/warp';
import { APPROX_EPSILON_RATIO, CANNY_HIGH, CANNY_LOW, MAX_CONTOUR_CANDIDATES, MIN_EDGE_POINTS, processFrame, refineQuad, warpPage } from '../src/workers/pipeline';

class MockMat implements PipelineMat {
  deleted = false;
  doubleValue = 0;
  rows = 0;
  data32S: Int32Array<ArrayBufferLike> = new Int32Array(0);
  payload: { area: number; peri: number; rows: number; data: Int32Array } | null = null;
  /** Ordinal del roi que lo creó (-1 si no es crop de banda). */
  bandOrdinal = -1;
  delete(): void {
    this.deleted = true;
  }
  doubleAt(_row: number, _col: number): number {
    return this.doubleValue;
  }
}

class MockMatVector implements PipelineMatVector {
  deleted = false;
  delete(): void {
    this.deleted = true;
  }
  size(): number {
    return 0;
  }
}

interface MockContour {
  area: number;
  peri: number;
  rows: number;
  data: Int32Array;
}

class MockCv implements CvApi {
  readonly COLOR_RGBA2GRAY = 6;
  readonly RETR_LIST = 1;
  readonly RETR_EXTERNAL = 0;
  readonly CHAIN_APPROX_SIMPLE = 2;
  readonly CV_64F = 6;
  readonly INTER_CUBIC = 2;
  mats: MockMat[] = [];
  vecs: MockMatVector[] = [];
  contours: MockContour[] = [];
  stdValue = 12;
  meanValue = 128;
  failOn: string | null = null;
  roiCalls: PipelineRect[] = [];
  approxEps: number[] = [];
  cannyArgs: number[] = [];
  findMode = -1;
  warpCalls: Array<{ dsize: PipelineSize; flags: number }> = [];
  perspSrc: Quadrilateral[] = [];
  perspDst: Quadrilateral[] = [];
  blurArgs: Array<{ k: PipelineSize; x: number; y: number }> = [];
  weightedArgs: number[][] = [];

  private reg(m: MockMat): MockMat {
    this.mats.push(m);
    return m;
  }
  matFromImageData(_img: ImageData): PipelineMat {
    return this.reg(new MockMat());
  }
  createMat(): PipelineMat {
    return this.reg(new MockMat());
  }
  createMatVector(): PipelineMatVector {
    const v = new MockMatVector();
    this.vecs.push(v);
    return v;
  }
  createSize(w: number, h: number): PipelineSize {
    return { width: w, height: h };
  }
  cvtColor(_s: PipelineMat, _d: PipelineMat, _c: number): void {}
  GaussianBlur(_s: PipelineMat, _d: PipelineMat, k: PipelineSize, x: number, y: number): void {
    this.blurArgs.push({ k: { ...k }, x, y });
  }
  Canny(s: PipelineMat, d: PipelineMat, _t1: number, _t2: number): void {
    if (this.failOn === 'Canny') throw new Error('mock Canny');
    this.cannyArgs = [_t1, _t2];
    // El mapa de bordes deriva del crop: hereda su banda (como en OpenCV real).
    (d as MockMat).bandOrdinal = (s as MockMat).bandOrdinal;
  }
  findContours(
    _img: PipelineMat,
    _c: PipelineMatVector,
    _h: PipelineMat,
    m1: number,
    _m2: number,
  ): void {
    this.findMode = m1;
  }
  contourCount(_v: PipelineMatVector): number {
    return this.contours.length;
  }
  getContour(_v: PipelineMatVector, i: number): PipelineMat {
    const m = this.reg(new MockMat());
    const c = this.contours[i]!;
    m.payload = { area: c.area, peri: c.peri, rows: c.rows, data: c.data };
    return m;
  }
  contourArea(m: PipelineMat): number {
    return (m as MockMat).payload?.area ?? 0;
  }
  arcLength(m: PipelineMat, _closed: boolean): number {
    return (m as MockMat).payload?.peri ?? 0;
  }
  approxPolyDP(src: PipelineMat, dst: PipelineMat, eps: number, _closed: boolean): void {
    this.approxEps.push(eps);
    const p = (src as MockMat).payload!;
    (dst as MockMat).rows = p.rows;
    (dst as MockMat).data32S = p.data;
  }
  Laplacian(_s: PipelineMat, _d: PipelineMat, _depth: number): void {}
  meanStdDev(_s: PipelineMat, m: PipelineMat, stddev: PipelineMat): void {
    (stddev as MockMat).doubleValue = this.stdValue;
    (m as MockMat).doubleValue = this.meanValue;
  }
  roi(_s: PipelineMat, r: PipelineRect): PipelineMat {
    this.roiCalls.push({ ...r });
    const m = this.reg(new MockMat());
    m.bandOrdinal = this.roiCalls.length - 1;
    return m;
  }
  /** Bordes sintéticos por banda (F3-b): el test decide qué píxeles ve Canny. */
  edgeFn: ((rect: PipelineRect, side: number) => Uint8Array) | null = null;
  bandSides: number[] = [];
  matDataU8(m: PipelineMat, w: number, h: number): Uint8Array {
    const tag = (m as MockMat).bandOrdinal;
    if (this.edgeFn !== null && tag >= 0 && this.roiCalls[tag] !== undefined) {
      return this.edgeFn(this.roiCalls[tag]!, this.bandSides[tag] ?? -1);
    }
    return new Uint8Array(w * h);
  }
  getPerspectiveTransform(src: Quadrilateral, dst: Quadrilateral): PipelineMat {
    if (this.failOn === 'persp') throw new Error('mock persp');
    this.perspSrc.push(src);
    this.perspDst.push(dst);
    return this.reg(new MockMat());
  }
  warpPerspective(
    _s: PipelineMat,
    _d: PipelineMat,
    _m: PipelineMat,
    dsize: PipelineSize,
    flags: number,
  ): void {
    this.warpCalls.push({ dsize: { ...dsize }, flags });
  }
  addWeighted(
    _s1: PipelineMat,
    a: number,
    _s2: PipelineMat,
    b: number,
    g: number,
    _d: PipelineMat,
  ): void {
    this.weightedArgs.push([a, b, g]);
  }
  matDataRGBA(_m: PipelineMat, w: number, h: number): Uint8ClampedArray {
    return new Uint8ClampedArray(w * h * 4).fill(200);
  }
  get allDeleted(): boolean {
    return this.mats.every((m) => m.deleted) && this.vecs.every((v) => v.deleted);
  }
}

function fakeImageData(w = 100, h = 100): ImageData {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
}

/** Solo dims, sin píxeles: los mocks no leen el contenido (el Canny real sí,
 *  en el worker). Evita alocar 48MB para el fixture 3000×4000. */
function dimsOnly(w: number, h: number): ImageData {
  return { width: w, height: h, data: new Uint8ClampedArray(0) } as ImageData;
}

/** Contorno cuadrado 90×90 en proceso 100×100, frame 200×200 → quad 81% área. */
function bigSquare(): MockContour {
  return {
    area: 8100,
    peri: 360,
    rows: 4,
    data: new Int32Array([5, 5, 95, 5, 95, 95, 5, 95]),
  };
}

describe('processFrame (detector F1)', () => {
  it('detecta el quad: fracciones del frame ORIGINAL + epsilon 0.02·peri', () => {
    const cv = new MockCv();
    cv.contours = [bigSquare()];
    const r = processFrame(cv, fakeImageData(), 200, 200, 1234);
    expect(r.type).toBe('result');
    expect(cv.approxEps).toEqual([APPROX_EPSILON_RATIO * 360]);
    expect(APPROX_EPSILON_RATIO).toBe(0.02);
    // (5,5)-(95,95) en proceso ×2 → (10,10)-(190,190): fracciones .05/.95
    const got = Array.from(r.corners!);
    const want = [0.05, 0.05, 0.95, 0.05, 0.95, 0.95, 0.05, 0.95];
    expect(got).toHaveLength(8);
    got.forEach((v, i) => expect(v).toBeCloseTo(want[i]!, 6)); // Float32
    expect(r.ts).toBe(1234);
  });
  it('stats del CROP del quad (roi en coords de proceso, clamp)', () => {
    const cv = new MockCv();
    cv.contours = [bigSquare()];
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.roiCalls).toEqual([{ x: 5, y: 5, width: 90, height: 90 }]);
    expect(r.qualityInput).toEqual({
      laplacianVar: 144,
      cropMean: 128,
      cropStdDev: 12,
      frameW: 200,
      frameH: 200,
      diag: { contourCount: 1 },
    });
  });
  it('usa los umbrales Canny calibrados F1 (default) y acepta override', () => {
    const cv = new MockCv();
    cv.contours = [bigSquare()];
    processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.cannyArgs).toEqual([CANNY_LOW, CANNY_HIGH]);
    expect([CANNY_LOW, CANNY_HIGH]).toEqual([50, 150]);
    processFrame(cv, fakeImageData(), 200, 200, 0, { low: 75, high: 200 });
    expect(cv.cannyArgs).toEqual([75, 200]);
  });
  it('F1-opt P1: findContours con RETR_EXTERNAL (palanca FPS)', () => {
    const cv = new MockCv();
    processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.findMode).toBe(cv.RETR_EXTERNAL);
  });
  it('F1-opt P2: approx solo al top-8 por área (MAX_CONTOUR_CANDIDATES)', () => {
    expect(MAX_CONTOUR_CANDIDATES).toBe(8);
    const cv = new MockCv();
    cv.contours = Array.from({ length: 10 }, (_, i) => ({ ...bigSquare(), area: 8100 - i }));
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.approxEps).toHaveLength(8);
    expect(r.corners).not.toBeNull(); // el mayor sigue ganando
  });
  it('triángulo (3 vértices) → null + stats del frame (sin roi)', () => {
    const cv = new MockCv();
    cv.contours = [{ area: 5000, peri: 300, rows: 3, data: new Int32Array([1, 1, 2, 2, 3, 3]) }];
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(r.corners).toBeNull();
    expect(cv.roiCalls).toEqual([]);
    expect(r.qualityInput.laplacianVar).toBe(144);
  });
  it('sin contornos → null', () => {
    const cv = new MockCv();
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(r.corners).toBeNull();
  });
  it('contorno enano (<0.5% área) ni se aproxima', () => {
    const cv = new MockCv();
    cv.contours = [{ area: 10, peri: 12, rows: 4, data: new Int32Array(8) }];
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.approxEps).toEqual([]);
    expect(r.corners).toBeNull();
  });
  it('creados == destruidos con detección (incl. contornos y approx)', () => {
    const cv = new MockCv();
    cv.contours = [bigSquare(), bigSquare()];
    processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(cv.mats.length).toBeGreaterThan(8);
    expect(cv.allDeleted).toBe(true);
  });
  it('creados == destruidos aunque Canny lance a mitad', () => {
    const cv = new MockCv();
    cv.failOn = 'Canny';
    expect(() => processFrame(cv, fakeImageData(), 200, 200, 0)).toThrow('mock Canny');
    expect(cv.allDeleted).toBe(true);
  });
  it('std no finito → laplacianVar null (sin NaN aguas abajo)', () => {
    const cv = new MockCv();
    cv.stdValue = NaN;
    const r = processFrame(cv, fakeImageData(), 200, 200, 0);
    expect(r.qualityInput.laplacianVar).toBeNull();
  });
});

describe('warpPage (rectificado F3-c)', () => {
  const QUAD: Quadrilateral = [
    { x: 10, y: 20 },
    { x: 90, y: 20 },
    { x: 90, y: 80 },
    { x: 10, y: 80 },
  ];
  it('homografía quad→recto + warp INTER_CUBIC al tamaño pedido', () => {
    const cv = new MockCv();
    const out = warpPage(cv, fakeImageData(100, 100), QUAD, 80, 60);
    expect(out.width).toBe(80);
    expect(out.height).toBe(60);
    expect(out.data).toHaveLength(80 * 60 * 4);
    expect(cv.perspSrc).toHaveLength(1);
    expect(cv.perspDst).toEqual([[{ x: 0, y: 0 }, { x: 80, y: 0 }, { x: 80, y: 60 }, { x: 0, y: 60 }]]);
    expect(cv.warpCalls).toEqual([{ dsize: { width: 80, height: 60 }, flags: cv.INTER_CUBIC }]);
    expect(cv.INTER_CUBIC).toBe(2);
  });
  it('unsharp con radio/sigma y mezcla del core (0.5/1.5)', () => {
    const cv = new MockCv();
    warpPage(cv, fakeImageData(100, 100), QUAD, 80, 60);
    expect(UNSHARP_RADIUS).toBe(1.5);
    expect(cv.blurArgs).toEqual([
      { k: { width: UNSHARP_KERNEL_SIZE, height: UNSHARP_KERNEL_SIZE }, x: 1.5, y: 1.5 },
    ]);
    expect(cv.weightedArgs).toEqual([[1 + UNSHARP_AMOUNT, -UNSHARP_AMOUNT, 0]]);
    expect(UNSHARP_AMOUNT).toBe(0.5);
  });
  it('creados == destruidos (H + warp + blur + sharp dentro de withMats)', () => {
    const cv = new MockCv();
    warpPage(cv, fakeImageData(100, 100), QUAD, 80, 60);
    expect(cv.mats.length).toBeGreaterThanOrEqual(5);
    expect(cv.allDeleted).toBe(true);
  });
  it('excepción a mitad (persp) → todo lo creado se destruye + propaga', () => {
    const cv = new MockCv();
    cv.failOn = 'persp';
    expect(() => warpPage(cv, fakeImageData(100, 100), QUAD, 80, 60)).toThrow('mock persp');
    expect(cv.allDeleted).toBe(true);
  });
});

describe('refineQuad (F3-b, blindajes 1-3)', () => {
  const GT: Quadrilateral = [
    { x: 600, y: 800 },
    { x: 2400, y: 800 },
    { x: 2400, y: 3200 },
    { x: 600, y: 3200 },
  ];

  /** Rasteriza el lado GT `side` recortado a `rect`: ruido perpendicular
   *  determinista ±0.4px + outliers de +8px SOLO en el 12% extremo (zona que
   *  recorta el trim del blindaje 2). Redondeo simétrico (sin sesgo de floor). */
  function rasterGT(rect: PipelineRect, side: number): Uint8Array {
    const buf = new Uint8Array(rect.width * rect.height);
    const a = GT[side]!;
    const b = GT[(side + 1) % 4]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const set = (x: number, y: number) => {
      const lx = Math.round(x - rect.x);
      const ly = Math.round(y - rect.y);
      if (lx >= 0 && ly >= 0 && lx < rect.width && ly < rect.height) {
        buf[ly * rect.width + lx] = 255;
      }
    };
    const n = Math.ceil(len);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const off = ((((k * 37) % 11) - 5) / 10) * 0.8;
      let x = a.x + (b.x - a.x) * t + nx * off;
      let y = a.y + (b.y - a.y) * t + ny * off;
      if (t < 0.12 || t > 0.88) {
        x += nx * 8;
        y += ny * 8;
      }
      set(x, y);
    }
    return buf;
  }

  function gtMock(emptySides: number[] = []): MockCv {
    const cv = new MockCv();
    cv.edgeFn = (rect, side) => (emptySides.includes(side) ? new Uint8Array(rect.width * rect.height) : rasterGT(rect, side));
    return cv;
  }

  function cornerErr(q: Quadrilateral, gt: Quadrilateral): number {
    let m = 0;
    for (let i = 0; i < 4; i++) {
      m = Math.max(m, Math.hypot(q[i]!.x - gt[i]!.x, q[i]!.y - gt[i]!.y));
    }
    return m;
  }

  it('MIN_EDGE_POINTS = 20 (ingeniería F3-b)', () => {
    expect(MIN_EDGE_POINTS).toBe(20);
  });

  it('bandas con bordes → 4/4 ajustados, esquinas ≈ intersecciones', () => {
    const cv = gtMock();
    cv.bandSides = [0, 1, 2, 3];
    const r = refineQuad(cv, dimsOnly(3000, 4000), GT);
    expect(r.fellBack).toEqual([false, false, false, false]);
    expect(cornerErr(r.quad, GT)).toBeLessThan(1);
  });

  it('banda vacía (lado 2) → fallback SOLO de sus esquinas (blindaje 3)', () => {
    const cv = gtMock([2]);
    cv.bandSides = [0, 1, 2, 3];
    const entry: Quadrilateral = [
      { x: 610, y: 810 },
      { x: 2390, y: 810 },
      { x: 2390, y: 3190 },
      { x: 610, y: 3190 },
    ];
    const r = refineQuad(cv, dimsOnly(3000, 4000), entry);
    expect(r.fellBack).toEqual([false, false, true, false]);
    // Esquinas 0,1 refinadas (≈GT); 2,3 de entrada.
    expect(Math.hypot(r.quad[0]!.x - 600, r.quad[0]!.y - 800)).toBeLessThan(1);
    expect(r.quad[2]).toEqual(entry[2]);
    expect(r.quad[3]).toEqual(entry[3]);
  });

  it('banda con 5 puntos (<20) → lado caído', () => {
    const cv = new MockCv();
    cv.bandSides = [0, 1, 2, 3];
    cv.edgeFn = (rect, side) => {
      if (side !== 0) return rasterGT(rect, side);
      const buf = new Uint8Array(rect.width * rect.height);
      for (let i = 0; i < 5; i++) buf[i] = 255;
      return buf;
    };
    const r = refineQuad(cv, dimsOnly(3000, 4000), GT);
    expect(r.fellBack[0]).toBe(true);
  });

  it('creados == destruidos (gray + 2 Mats por banda)', () => {
    const cv = gtMock();
    cv.bandSides = [0, 1, 2, 3];
    refineQuad(cv, dimsOnly(3000, 4000), GT);
    expect(cv.mats.length).toBeGreaterThanOrEqual(10);
    expect(cv.allDeleted).toBe(true);
  });

  it('MEJORA MEDIBLE (DoD precisión): entrada ±6px → refinado <1px del GT', () => {
    // Simula detección a 400-clase escalada ×7.5: error ~±6px por esquina.
    const entry: Quadrilateral = [
      { x: 606, y: 806 },
      { x: 2394, y: 806 },
      { x: 2394, y: 3194 },
      { x: 606, y: 3194 },
    ];
    const cv = gtMock();
    cv.bandSides = computeBandRects(entry, 3000, 4000).map((b) => b.side);
    expect(cv.bandSides).toEqual([0, 1, 2, 3]);
    const unrefined = cornerErr(entry, GT);
    const r = refineQuad(cv, dimsOnly(3000, 4000), entry);
    const refined = cornerErr(r.quad, GT);
    // eslint-disable-next-line no-console
    console.log(`MEJORA cornerErr: sin refinar=${unrefined.toFixed(2)}px refinado=${refined.toFixed(3)}px`);
    expect(unrefined).toBeGreaterThan(6); // el fixture sí simula el error 400-clase
    expect(r.fellBack).toEqual([false, false, false, false]);
    expect(refined).toBeLessThan(1);
  });
});
