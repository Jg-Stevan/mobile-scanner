// src/workers/detection.worker.ts — esqueleto funcional del worker (T4).
// Carga OpenCV.js REAL (importScripts + onRuntimeInitialized) con protocolo
// boot/ready/error; procesa frames con backpressure por descarte ({type:'busy'});
// todo cv.Mat dentro de withMats() vía pipeline.processFrame().
// STUB: corners siempre null (F1 conecta el QuadDetector); el E2E mide el
// throughput REAL del preproceso 480p en WASM.
//
// Nota de tipos: tsconfig solo incluye lib DOM (sin WebWorker), así que el
// scope se declara mínimo aquí en vez de tocar la config global.

import type { CvApi } from './pipeline';
import { processFrame } from './pipeline';
import type { WorkerIn, WorkerOut } from './protocol';
import { OPENCV_CDN_URL } from './protocol';

// NOTA (T4): este worker se instancia como CLASSIC worker
// (`new Worker(url)` sin type:module) porque OpenCV.js es UMD y se carga con
// importScripts (inexistente en module workers; el fetch alternativo exigiría
// CORS que el CDN oficial no envía). Vite bundling (dev con ?worker o build
// prod) resuelve los imports ESM del resto del archivo.

declare function importScripts(...urls: string[]): void;

interface WorkerScope {
  postMessage(msg: WorkerOut, transfer?: Transferable[]): void;
  onmessage: ((ev: MessageEvent<WorkerIn>) => void) | null;
}

declare const self: WorkerScope & {
  [k: string]: unknown;
};

function post(msg: WorkerOut): void {
  self.postMessage(msg);
}

/** Adapta el namespace cv global (any: OpenCV.js no trae tipos) a CvApi. */
function adaptCv(cv: {
  COLOR_RGBA2GRAY: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  CV_64F: number;
  matFromImageData(img: ImageData): never;
  Mat: new () => never;
  MatVector: new () => never;
  Size: new (w: number, h: number) => never;
  Rect: new (x: number, y: number, w: number, h: number) => never;
  cvtColor(...a: never[]): void;
  GaussianBlur(...a: never[]): void;
  Canny(...a: never[]): void;
  findContours(...a: never[]): void;
  contourArea(...a: never[]): number;
  arcLength(...a: never[]): number;
  approxPolyDP(...a: never[]): void;
  Laplacian(...a: never[]): void;
  meanStdDev(...a: never[]): void;
}): CvApi {
  return {
    COLOR_RGBA2GRAY: cv.COLOR_RGBA2GRAY,
    RETR_LIST: cv.RETR_LIST,
    CHAIN_APPROX_SIMPLE: cv.CHAIN_APPROX_SIMPLE,
    CV_64F: cv.CV_64F,
    matFromImageData: (img) => cv.matFromImageData(img) as never as ReturnType<CvApi['matFromImageData']>,
    createMat: () => new cv.Mat() as never as ReturnType<CvApi['createMat']>,
    createMatVector: () => new cv.MatVector() as never as ReturnType<CvApi['createMatVector']>,
    createSize: (w, h) => new cv.Size(w, h) as never as ReturnType<CvApi['createSize']>,
    cvtColor: (s, d, c) => cv.cvtColor(s as never, d as never, c as never),
    GaussianBlur: (s, d, k, x, y) =>
      cv.GaussianBlur(s as never, d as never, k as never, x as never, y as never),
    Canny: (s, d, t1, t2) => cv.Canny(s as never, d as never, t1 as never, t2 as never),
    findContours: (img, c, h, m1, m2) =>
      cv.findContours(img as never, c as never, h as never, m1 as never, m2 as never),
    contourCount: (v) => (v as unknown as { size(): number }).size(),
    getContour: (v, i) =>
      (v as unknown as { get(idx: number): unknown }).get(i) as ReturnType<
        CvApi['getContour']
      >,
    contourArea: (m) => cv.contourArea(m as never),
    arcLength: (m, closed) => cv.arcLength(m as never, closed as never),
    approxPolyDP: (s, d, eps, closed) =>
      cv.approxPolyDP(s as never, d as never, eps as never, closed as never),
    Laplacian: (s, d, depth) => cv.Laplacian(s as never, d as never, depth as never),
    meanStdDev: (s, m, v) => cv.meanStdDev(s as never, m as never, v as never),
    roi: (m, r) =>
      (m as unknown as { roi(rect: unknown): unknown }).roi(
        new cv.Rect(r.x, r.y, r.width, r.height),
      ) as ReturnType<CvApi['roi']>,
  };
}

let cvApi: CvApi | null = null;
let busy = false;
let canvas: OffscreenCanvas | null = null;

post({ type: 'boot', pct: 5 });

try {
  const holder = self as { Module?: { onRuntimeInitialized?: () => void } };
  holder.Module = holder.Module ?? {};
  holder.Module.onRuntimeInitialized = () => {
    const cv = self['cv'];
    if (cv === undefined || cv === null) {
      post({ type: 'error', message: 'opencv.js cargó pero `cv` es undefined' });
      return;
    }
    cvApi = adaptCv(cv as Parameters<typeof adaptCv>[0]);
    post({ type: 'ready' });
  };
  // importScripts es síncrono y no necesita CORS (script clásico).
  importScripts(OPENCV_CDN_URL);
} catch (e) {
  post({ type: 'error', message: `carga opencv.js falló: ${e instanceof Error ? e.message : String(e)}` });
}

self.onmessage = (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data;
  if (msg.type !== 'detect') return;
  if (cvApi === null) return; // aún cargando: se descarta (backpressure total)
  if (busy) {
    post({ type: 'busy', ts: msg.ts });
    return;
  }
  busy = true;
  const bitmap = msg.bitmap;
  try {
    if (canvas === null || canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
      canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('OffscreenCanvas 2d null');
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    const reply = processFrame(cvApi, imageData, bitmap.width, bitmap.height, msg.ts);
    post(reply);
  } catch (e) {
    post({ type: 'error', message: e instanceof Error ? e.message : String(e) });
  } finally {
    try {
      bitmap.close();
    } catch {
      // bitmap ya cerrado/neutered: nada que hacer
    }
    busy = false;
  }
};
