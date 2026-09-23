// src/workers/pipeline.ts — pipeline de proceso por frame (F1: detector real).
// Recibe el cv como INTERFAZ (CvApi), no como global: los unit tests inyectan
// un mock que cuenta create/delete y verifica withMats() sin WASM.
//
// F1 (decisión documentada): preproceso a 480p-clase (grayscale → blur → Canny
// → contornos) + QuadDetector (top por área → approxPolyDP(0.02·peri) → 4
// vértices → selectQuad del core con validateQuad aprobada). La geometría vive
// en core (pura); OpenCV solo píxeles. Salida: corners Float32Array(8) en
// FRACCIONES del frame ORIGINAL (invariantes por eje ante resize anisotrópico)
// o null. qualityInput: laplacianVar + media/desv del CROP del quad (contrato
// 480p de quality.ts) o del frame completo si no hay quad.

import type { Quadrilateral } from '../core/types';
import type { Corner } from '../core/types';
import type { LineEq, RefineResult } from '../core/geometry';
import { fitLineTrimmed, refineQuadFromLines } from '../core/geometry';
import type { ScoredPoly } from '../core/quadSelect';
import { computeBandRects } from '../core/cornerBands';
import type { BandRect } from '../core/cornerBands';
import { UNSHARP_AMOUNT, UNSHARP_KERNEL_SIZE, UNSHARP_RADIUS } from '../core/warp';
import { scalePoly, selectQuad } from '../core/quadSelect';
import type { RawQualityInput, ResultReply } from './protocol';
import { withMats } from './withMats';

/** Mat mínimo que usa el pipeline (cv.Mat real lo satisface). */
export interface PipelineMat {
  delete(): void;
  doubleAt(row: number, col: number): number;
  /** Filas (para leer vértices de approxPolyDP: Nx1x2 CV_32S). */
  rows: number;
  /** Vista i32 de los datos (approx: [x0,y0,x1,y1,…]). */
  data32S: Int32Array<ArrayBufferLike>;
}

export interface PipelineMatVector {
  delete(): void;
  size(): number;
}

export interface PipelineSize {
  width: number;
  height: number;
}

export interface PipelineRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Superficie exacta de OpenCV.js que el pipeline necesita (ni una más). */
export interface CvApi {
  readonly COLOR_RGBA2GRAY: number;
  readonly RETR_LIST: number;
  /** F1-opt palanca 1: solo contornos exteriores (las arrugas del papel generan
   *  internos que se aproximaban en vano). Origen: profiling Fase 0. */
  readonly RETR_EXTERNAL: number;
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
  contourCount(contours: PipelineMatVector): number;
  getContour(contours: PipelineMatVector, i: number): PipelineMat;
  contourArea(cnt: PipelineMat): number;
  arcLength(cnt: PipelineMat, closed: boolean): number;
  approxPolyDP(src: PipelineMat, dst: PipelineMat, epsilon: number, closed: boolean): void;
  Laplacian(src: PipelineMat, dst: PipelineMat, depth: number): void;
  meanStdDev(src: PipelineMat, mean: PipelineMat, stddev: PipelineMat): void;
  roi(src: PipelineMat, rect: PipelineRect): PipelineMat;
  /** F3-c (mínimo para warpPage, ni una más): interpolación cúbica del warp. */
  readonly INTER_CUBIC: number;
  /** H = quad src → quad dst (como cv.getPerspectiveTransform: RETORNA el Mat 3×3). */
  getPerspectiveTransform(src: Quadrilateral, dst: Quadrilateral): PipelineMat;
  warpPerspective(
    src: PipelineMat,
    dst: PipelineMat,
    M: PipelineMat,
    dsize: PipelineSize,
    flags: number,
  ): void;
  addWeighted(
    src1: PipelineMat,
    alpha: number,
    src2: PipelineMat,
    beta: number,
    gamma: number,
    dst: PipelineMat,
  ): void;
  /** Píxeles RGBA del Mat (COPIA — la memoria WASM se reutiliza después). */
  matDataRGBA(m: PipelineMat, w: number, h: number): Uint8ClampedArray;
  /** Píxeles U8 de un canal del Mat (COPIA; p. ej. mapa Canny 0/255). */
  matDataU8(m: PipelineMat, w: number, h: number): Uint8Array;
}

/** Umbrales de Canny (F1 Fase 0, benchmark sobre 6 fixtures sintéticos):
 *  empate en detección b/c/d entre 50/150 y 75/200 (mismo err ~0.002);
 *  50/150 gana por COSTO (~10ms vs segundos en ruido: menos fragmentación de
 *  contornos con RETR_LIST). Evidencia: PLAN_EVIDENCE/F1/bench-fase0.json. */
export const CANNY_LOW = 50;
export const CANNY_HIGH = 150;

/** Epsilon de approxPolyDP como fracción del perímetro (spec F1). */
export const APPROX_EPSILON_RATIO = 0.02;

/** Prefiltro de rendimiento (F1-a): contornos bajo el 0.5% del área de proceso
 *  ni se aproximan. Origen HONESTO: ingeniería, no benchmark — ningún contorno
 *  bajo 0.5% podría pasar el validateQuad del core (≥25%), así que aproximarlo
 *  es puro costo. NO es umbral de calidad (la decisión la toma selectQuad). */
export const MIN_CONTOUR_AREA_PCT = 0.005;

/** F1-opt P2: top-N contornos por área que llegan a approxPolyDP. Origen:
 *  ingeniería F1-opt con expectativa calibrada — la evidencia P1 indica que el
 *  bottleneck del Exynos NO está en el conteo (se aplica por orden aprobado y
 *  costo cero, no por ganancia esperada). selectQuad ya miraba top-5; el cap
 *  evita aproximar el resto. */
export const MAX_CONTOUR_CANDIDATES = 8;

/** F3-b (ingeniería): mínimo de píxeles de borde en una banda para ajustar su
 *  recta. Menos que esto = banda sin información (borde fuera de banda o
 *  ocluido) → lado caído al blindaje 3. */
export const MIN_EDGE_POINTS = 20;

function clampRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  h: number,
): PipelineRect | null {
  const x = Math.max(0, Math.min(x0, x1));
  const y = Math.max(0, Math.min(y0, y1));
  const xe = Math.min(w, Math.max(x0, x1));
  const ye = Math.min(h, Math.max(y0, y1));
  if (xe - x < 1 || ye - y < 1) return null;
  return { x, y, width: xe - x, height: ye - y };
}

function toFractions(q: Quadrilateral, frameW: number, frameH: number): Float32Array {
  const out = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    out[2 * i] = q[i]!.x / frameW;
    out[2 * i + 1] = q[i]!.y / frameH;
  }
  return out;
}

/** Procesa un frame (imageData en dims de PROCESO) referido al frame original
 *  (frameW/H). Todos los Mats nacen dentro de withMats().
 *  @param canny override de umbrales (benchmark Fase 0; default = constantes). */
export function processFrame(
  cv: CvApi,
  imageData: ImageData,
  frameW: number,
  frameH: number,
  ts: number,
  canny: { low: number; high: number } = { low: CANNY_LOW, high: CANNY_HIGH },
): ResultReply {
  const procW = imageData.width;
  const procH = imageData.height;
  const sx = frameW / procW;
  const sy = frameH / procH;

  return withMats((track) => {
    const rgba = track(cv.matFromImageData(imageData));
    const gray = track(cv.createMat());
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    const blur = track(cv.createMat());
    cv.GaussianBlur(gray, blur, cv.createSize(5, 5), 0, 0);
    const edges = track(cv.createMat());
    cv.Canny(blur, edges, canny.low, canny.high);
    const contours = track(cv.createMatVector());
    const hierarchy = track(cv.createMat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // QuadDetector: top-8 por área → approx → 4 vértices → core (P2: el cap
    // va ANTES de approxPolyDP para no aproximar en vano).
    const minArea = procW * procH * MIN_CONTOUR_AREA_PCT;
    const cands: Array<{ cnt: PipelineMat; area: number }> = [];
    const n = cv.contourCount(contours);
    for (let i = 0; i < n; i++) {
      const cnt = track(cv.getContour(contours, i));
      const area = cv.contourArea(cnt);
      if (area < minArea) continue;
      cands.push({ cnt, area });
    }
    cands.sort((a, b) => b.area - a.area);
    const polys: ScoredPoly[] = [];
    const top = cands.slice(0, MAX_CONTOUR_CANDIDATES);
    for (const { cnt, area } of top) {
      const peri = cv.arcLength(cnt, true);
      const approx = track(cv.createMat());
      cv.approxPolyDP(cnt, approx, APPROX_EPSILON_RATIO * peri, true);
      if (approx.rows !== 4) continue;
      const pts = [
        { x: approx.data32S[0]!, y: approx.data32S[1]! },
        { x: approx.data32S[2]!, y: approx.data32S[3]! },
        { x: approx.data32S[4]!, y: approx.data32S[5]! },
        { x: approx.data32S[6]!, y: approx.data32S[7]! },
      ];
      polys.push({ points: scalePoly(pts, sx, sy), area: area * sx * sy });
    }
    const quad = selectQuad(polys, frameW, frameH);

    // Stats del crop del quad (contrato quality.ts) o del frame si no hay quad.
    let statSrc: PipelineMat = gray;
    if (quad !== null) {
      const xs = quad.map((c) => c.x);
      const ys = quad.map((c) => c.y);
      // bbox en coords de PROCESO (el roi se corta del gray de proceso)
      const rect = clampRect(
        Math.min(...xs) / sx,
        Math.min(...ys) / sy,
        Math.max(...xs) / sx,
        Math.max(...ys) / sy,
        procW,
        procH,
      );
      if (rect !== null) {
        statSrc = track(cv.roi(gray, rect));
      }
    }
    const lap = track(cv.createMat());
    cv.Laplacian(statSrc, lap, cv.CV_64F);
    const mean = track(cv.createMat());
    const stddev = track(cv.createMat());
    cv.meanStdDev(lap, mean, stddev);
    const s = stddev.doubleAt(0, 0);
    cv.meanStdDev(statSrc, mean, stddev);
    const sd = stddev.doubleAt(0, 0);
    const md = mean.doubleAt(0, 0);
    const qualityInput: RawQualityInput = {
      laplacianVar: Number.isFinite(s) ? s * s : null,
      cropMean: Number.isFinite(md) ? md : null,
      cropStdDev: Number.isFinite(sd) ? sd : null,
      frameW,
      frameH,
      diag: { contourCount: n },
    };
    return {
      type: 'result',
      corners: quad === null ? null : toFractions(quad, frameW, frameH),
      qualityInput,
      ts,
    };
  });
}

/** Rectifica la página (F3-c, PLAN_MAESTRO §F3): homografía quad→recto +
 *  warpPerspective INTER_CUBIC + unsharp (amount/radius del core).
 *  `quadPx` en PÍXELES de `foto`; salida `outW×outH` (dims de computeWarpDims).
 *  Todos los Mats nacen dentro de withMats(). */
export function warpPage(
  cv: CvApi,
  foto: ImageData,
  quadPx: Quadrilateral,
  outW: number,
  outH: number,
): ImageData {
  return withMats((track) => {
    const src = track(cv.matFromImageData(foto));
    const M = track(
      cv.getPerspectiveTransform(quadPx, [
        { x: 0, y: 0 },
        { x: outW, y: 0 },
        { x: outW, y: outH },
        { x: 0, y: outH },
      ]),
    );
    const warped = track(cv.createMat());
    cv.warpPerspective(src, warped, M, cv.createSize(outW, outH), cv.INTER_CUBIC);
    const blur = track(cv.createMat());
    cv.GaussianBlur(
      warped,
      blur,
      cv.createSize(UNSHARP_KERNEL_SIZE, UNSHARP_KERNEL_SIZE),
      UNSHARP_RADIUS,
      UNSHARP_RADIUS,
    );
    const sharp = track(cv.createMat());
    cv.addWeighted(warped, 1 + UNSHARP_AMOUNT, blur, -UNSHARP_AMOUNT, 0, sharp);
    return {
      width: outW,
      height: outH,
      data: cv.matDataRGBA(sharp, outW, outH),
    } as ImageData;
  });
}

/** Borde de un lado en coords de FOTO (salida de extractBandEdges). */
export interface BandEdges {
  side: 0 | 1 | 2 | 3;
  points: Corner[];
}

/** Píxeles de borde (Canny 50/150, constantes F1) por banda, en coords de foto.
 *  Muestreo con stride + cap derivado de MIN_EDGE_POINTS (×100): acota el costo
 *  en bandas grandes sin nueva constante. Todos los Mats en withMats(). */
export function extractBandEdges(
  cv: CvApi,
  foto: ImageData,
  bands: BandRect[],
): BandEdges[] {
  return withMats((track) => {
    const src = track(cv.matFromImageData(foto));
    const gray = track(cv.createMat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    return bands.map((b) => {
      const crop = track(cv.roi(gray, b));
      const edges = track(cv.createMat());
      cv.Canny(crop, edges, CANNY_LOW, CANNY_HIGH);
      const px = cv.matDataU8(edges, b.width, b.height);
      const cap = MIN_EDGE_POINTS * 100;
      const stride = Math.max(1, Math.floor((b.width * b.height) / cap));
      const points: Corner[] = [];
      for (let i = 0; i < px.length; i += stride) {
        if (px[i]! > 0) {
          if (points.length >= cap) break;
          points.push({ x: b.x + (i % b.width), y: b.y + Math.floor(i / b.width) });
        }
      }
      return { side: b.side, points };
    });
  });
}

/** Línea degenerada: intersecciones siempre null → el blindaje 3 marca el lado
 *  caído y cae a sus esquinas de entrada. (intersectLines: den=0 → null.) */
const DEAD_LINE: LineEq = { a: 0, b: 0, c: 0 };

/** Refinado fino del quad a resolución de foto (F3-b, blindajes 1-3 §F3):
 *  bandas adaptativas (core) → bordes por banda → fitLineTrimmed (core, trim
 *  por defecto) → refineQuadFromLines (core, fallback POR LADO). Banda sin
 *  puntos suficientes o ajuste fallido → lado caído (DEAD_LINE). Sin bandas
 *  (quad degenerado) → todo caído. NUNCA lanza con entrada finita. */
export function refineQuad(
  cv: CvApi,
  foto: ImageData,
  quadPx: Quadrilateral,
): RefineResult {
  const bands = computeBandRects(quadPx, foto.width, foto.height);
  if (bands.length === 0) {
    return { quad: quadPx, fellBack: [true, true, true, true] };
  }
  const edges = extractBandEdges(cv, foto, bands);
  const bySide = new Map<number, Corner[]>();
  for (const e of edges) bySide.set(e.side, e.points);
  const lines: [LineEq, LineEq, LineEq, LineEq] = [DEAD_LINE, DEAD_LINE, DEAD_LINE, DEAD_LINE];
  for (let s = 0; s < 4; s++) {
    const pts = bySide.get(s) ?? [];
    if (pts.length < MIN_EDGE_POINTS) continue;
    try {
      lines[s] = fitLineTrimmed(pts);
    } catch {
      // ajuste imposible → lado caído (el warp sigue con la entrada)
    }
  }
  return refineQuadFromLines(lines[0], lines[1], lines[2], lines[3], quadPx);
}
