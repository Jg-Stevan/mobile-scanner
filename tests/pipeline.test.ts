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
import { APPROX_EPSILON_RATIO, CANNY_HIGH, CANNY_LOW, processFrame } from '../src/workers/pipeline';

class MockMat implements PipelineMat {
  deleted = false;
  doubleValue = 0;
  rows = 0;
  data32S: Int32Array<ArrayBufferLike> = new Int32Array(0);
  payload: { area: number; peri: number; rows: number; data: Int32Array } | null = null;
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
  GaussianBlur(_s: PipelineMat, _d: PipelineMat, _k: PipelineSize, _x: number, _y: number): void {}
  Canny(_s: PipelineMat, _d: PipelineMat, _t1: number, _t2: number): void {
    if (this.failOn === 'Canny') throw new Error('mock Canny');
    this.cannyArgs = [_t1, _t2];
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
    return this.reg(new MockMat());
  }
  get allDeleted(): boolean {
    return this.mats.every((m) => m.deleted) && this.vecs.every((v) => v.deleted);
  }
}

function fakeImageData(w = 100, h = 100): ImageData {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as ImageData;
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
