// src/workers/pipeline.ts — pipeline de proceso por frame (T4, puro en cv).
// Recibe el cv como INTERFAZ (CvApi), no como global: así los unit tests
// inyectan un mock que cuenta create/delete y verifica withMats() sin WASM.
// El worker real adapta el cv global a CvApi (detection.worker.ts).
//
// STUB T4 (decisión documentada): corre el preproceso REAL a 480p
// (grayscale → blur → Canny → contornos → Laplaciano + meanStdDev) para medir
// throughput real, pero devuelve corners=null — el QuadDetector
// (approxPolyDP→quad) llega en F1. qualityInput lleva la varianza laplaciana
// cruda sobre el frame completo (sin crop: no hay quad hasta F1).

import type { RawQualityInput, ResultReply } from './protocol';
import { withMats } from './withMats';

/** Mat mínimo que usa el pipeline (cv.Mat real lo satisface: doubleAt existe). */
export interface PipelineMat {
  delete(): void;
  doubleAt(row: number, col: number): number;
}

export interface PipelineMatVector {
  delete(): void;
  size(): number;
}

export interface PipelineSize {
  width: number;
  height: number;
}

/** Superficie exacta de OpenCV.js que el pipeline necesita (ni una más). */
export interface CvApi {
  readonly COLOR_RGBA2GRAY: number;
  readonly RETR_LIST: number;
  readonly CHAIN_APPROX_SIMPLE: number;
  readonly CV_64F: number;
  matFromImageData(img: ImageData): PipelineMat;
  createMat(): PipelineMat;
  createMatVector(): PipelineMatVector;
  createSize(w: number, h: number): PipelineSize;
  cvtColor(src: PipelineMat, dst: PipelineMat, code: number): void;
  GaussianBlur(
    src: PipelineMat,
    dst: PipelineMat,
    ksize: PipelineSize,
    sigmaX: number,
    sigmaY: number,
  ): void;
  Canny(src: PipelineMat, dst: PipelineMat, t1: number, t2: number): void;
  findContours(
    img: PipelineMat,
    contours: PipelineMatVector,
    hierarchy: PipelineMat,
    mode: number,
    method: number,
  ): void;
  Laplacian(src: PipelineMat, dst: PipelineMat, depth: number): void;
  meanStdDev(src: PipelineMat, mean: PipelineMat, stddev: PipelineMat): void;
}

/** Umbrales de Canny del stub (fijos de ingeniería, NO del plan — F1 los afina
 *  con el QuadDetector; aquí solo dan carga realista al worker). */
export const STUB_CANNY_T1 = 50;
export const STUB_CANNY_T2 = 150;

/** Procesa un frame 480p y devuelve el ResultReply (corners siempre null en
 *  T4). Todos los Mats nacen dentro de withMats() — fuga imposible por diseño
 *  (ver tests/pipeline.test.ts con mock contador). */
export function processFrame(
  cv: CvApi,
  imageData: ImageData,
  frameW: number,
  frameH: number,
  ts: number,
): ResultReply {
  const qualityInput: RawQualityInput = withMats((track) => {
    const rgba = track(cv.matFromImageData(imageData));
    const gray = track(cv.createMat());
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    const blur = track(cv.createMat());
    cv.GaussianBlur(gray, blur, cv.createSize(5, 5), 0, 0);
    const edges = track(cv.createMat());
    cv.Canny(blur, edges, STUB_CANNY_T1, STUB_CANNY_T2);
    const contours = track(cv.createMatVector());
    const hierarchy = track(cv.createMat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
    void contours.size(); // T4: el conteo existe pero el quad se ignora (F1).
    const lap = track(cv.createMat());
    cv.Laplacian(gray, lap, cv.CV_64F);
    const mean = track(cv.createMat());
    const stddev = track(cv.createMat());
    cv.meanStdDev(lap, mean, stddev);
    const s = stddev.doubleAt(0, 0);
    const out: RawQualityInput = {
      laplacianVar: Number.isFinite(s) ? s * s : null,
      frameW,
      frameH,
    };
    return out;
  });
  return { type: 'result', corners: null, qualityInput, ts };
}
