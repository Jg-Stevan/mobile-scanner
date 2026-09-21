// tests/pipeline.test.ts — processFrame con cv mockeado (sin WASM).
// Verifica: forma del ResultReply (corners null + qualityInput cruda),
// laplacianVar = std², ts passthrough, y que creados == destruidos
// (con y sin excepción intermedia).
import { describe, expect, it } from 'vitest';

import type { CvApi, PipelineMat, PipelineMatVector, PipelineSize } from '../src/workers/pipeline';
import { STUB_CANNY_T1, STUB_CANNY_T2, processFrame } from '../src/workers/pipeline';

class MockMat implements PipelineMat {
  deleted = false;
  doubleValue = 0;
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

class MockCv implements CvApi {
  readonly COLOR_RGBA2GRAY = 6;
  readonly RETR_LIST = 1;
  readonly CHAIN_APPROX_SIMPLE = 2;
  readonly CV_64F = 6;
  mats: MockMat[] = [];
  vecs: MockMatVector[] = [];
  stdValue = 12;
  failOn: string | null = null;
  cannyArgs: number[] = [];

  private reg(m: MockMat): MockMat {
    this.mats.push(m);
    return m;
  }
  matFromImageData(_img: ImageData): PipelineMat {
    if (this.failOn === 'matFromImageData') throw new Error('mock matFromImageData');
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
  Canny(_s: PipelineMat, _d: PipelineMat, t1: number, t2: number): void {
    if (this.failOn === 'Canny') throw new Error('mock Canny');
    this.cannyArgs = [t1, t2];
  }
  findContours(
    _img: PipelineMat,
    _c: PipelineMatVector,
    _h: PipelineMat,
    _m1: number,
    _m2: number,
  ): void {}
  Laplacian(_s: PipelineMat, _d: PipelineMat, _depth: number): void {}
  meanStdDev(_s: PipelineMat, _m: PipelineMat, stddev: PipelineMat): void {
    (stddev as MockMat).doubleValue = this.stdValue;
  }
  get allDeleted(): boolean {
    return this.mats.every((m) => m.deleted) && this.vecs.every((v) => v.deleted);
  }
}

function fakeImageData(): ImageData {
  return {
    width: 640,
    height: 480,
    data: new Uint8ClampedArray(640 * 480 * 4),
  } as ImageData;
}

describe('processFrame (stub T4)', () => {
  it('devuelve result con corners null + laplacianVar = std² + ts', () => {
    const cv = new MockCv();
    const r = processFrame(cv, fakeImageData(), 640, 480, 1234);
    expect(r.type).toBe('result');
    expect(r.corners).toBeNull();
    expect(r.qualityInput).toEqual({ laplacianVar: 144, frameW: 640, frameH: 480 });
    expect(r.ts).toBe(1234);
  });
  it('usa los umbrales Canny del stub', () => {
    const cv = new MockCv();
    processFrame(cv, fakeImageData(), 640, 480, 0);
    expect(cv.cannyArgs).toEqual([STUB_CANNY_T1, STUB_CANNY_T2]);
  });
  it('creados == destruidos en la rama feliz (9 objetos: 8 Mats + 1 MatVector)', () => {
    const cv = new MockCv();
    processFrame(cv, fakeImageData(), 640, 480, 0);
    expect(cv.mats).toHaveLength(8);
    expect(cv.vecs).toHaveLength(1);
    expect(cv.allDeleted).toBe(true);
  });
  it('creados == destruidos aunque Canny lance a mitad', () => {
    const cv = new MockCv();
    cv.failOn = 'Canny';
    expect(() => processFrame(cv, fakeImageData(), 640, 480, 0)).toThrow('mock Canny');
    expect(cv.mats.length).toBeGreaterThan(0);
    expect(cv.allDeleted).toBe(true);
  });
  it('std no finito → laplacianVar null (sin NaN aguas abajo)', () => {
    const cv = new MockCv();
    cv.stdValue = NaN;
    const r = processFrame(cv, fakeImageData(), 640, 480, 0);
    expect(r.qualityInput.laplacianVar).toBeNull();
  });
});
