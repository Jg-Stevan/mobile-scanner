// src/workers/protocol.ts — contrato de mensajes UI ⇄ DetectionWorker (T4).
// Fijado por PLAN_MAESTRO §3 ("W"): requestVideoFrameCallback/ImageBitmap
// transferable → corners + score; backpressure por DESCARTE (nunca encolar).
// Vive en workers/ (no en core/) para no tocar la lógica aprobada de T2/T3.
// Corners en FRACCIONES (0–1) del frame, orden TL,TR,BR,BL — como el spike.

/** Resolución de proceso SQUASH (T4): fallback cuando se desconoce el aspecto
 *  del video o resizeMode='squash'. */
export const PROCESS_WIDTH = 640;
export const PROCESS_HEIGHT = 480;

/** Lado mayor de proceso en modo PRESERVE (F1-opt P3: 400 — era 480).
 *  Origen: F1-opt P3, aprobación humana A-primero (2026-09-22); evidencia P1/P2:
 *  bottleneck Exynos = costo fijo por píxel (−30% píxeles esperado ≈ +20-30%
 *  FPS). Trade-off: menor precisión de detección AMORTIGUADA por el
 *  CornerRefiner de F3 (refina a resolución completa sobre la foto hi-res).
 *  9:16 → 225×400. Evidencia: PLAN_EVIDENCE/F1-opt/bench-400.json. */
export const PROCESS_LONG_SIDE = 400;

export type ResizeMode = 'squash' | 'preserve';

/** Dims de proceso: preserve escala el lado mayor a 480 manteniendo aspecto;
 *  squash usa el fallback 640×480 (también si las dims del video son inválidas). */
export function computeProcessDims(
  videoW: number,
  videoH: number,
  mode: ResizeMode,
): { w: number; h: number } {
  if (mode !== 'preserve' || !(videoW > 0) || !(videoH > 0)) {
    return { w: PROCESS_WIDTH, h: PROCESS_HEIGHT };
  }
  const s = PROCESS_LONG_SIDE / Math.max(videoW, videoH);
  return {
    w: Math.max(1, Math.round(videoW * s)),
    h: Math.max(1, Math.round(videoH * s)),
  };
}

/** URL pineada del build oficial de OpenCV.js que carga el worker (T4).
 *  4.5.5: última con ruta estable verificada (4.10.0 devuelve 404 en ese path). */
export const OPENCV_CDN_URL = 'https://docs.opencv.org/4.5.5/opencv.js';

/** UI → Worker: un frame para procesar. `bitmap` viaja como TRANSFERABLE
 *  (el worker lo cierra tras leerlo; el main thread pierde acceso). */
export interface DetectRequest {
  type: 'detect';
  bitmap: ImageBitmap;
  /** Timestamp del frame (performance.now del main thread) para latencia. */
  ts: number;
}

/** Entrada cruda de calidad que el worker devuelve por frame (F1: valores
 *  CRUDOS — el QualityScorer del core los consume en F2, no se cablea aquí).
 *  NOTA F1-a (hallazgo 5 auditoría): en streams portrait con PRESERVE el crop
 *  sale a ~270×480, no 480p exactos — consistente entre frames, pero los
 *  umbrales (BLUR_THRESHOLD/SHARPNESS_NORM) se RECALIBRAN en F2 con reales. */
export interface RawQualityInput {
  /** Varianza del Laplaciano sobre el CROP del quad (contrato 480p de
   *  quality.ts); frame completo si no hay quad. null si no medible. */
  laplacianVar: number | null;
  /** Media del crop en gris (null si no medible). */
  cropMean: number | null;
  /** Desviación del crop en gris (null si no medible). */
  cropStdDev: number | null;
  frameW: number;
  frameH: number;
  /** Diagnóstico F2-a (ADITIVO, opcional): nº de contornos encontrados —
    para elegir la palanca de FPS con dato (caso "documento denso"), no teoría. */
  diag?: {
    contourCount: number;
  };
}

/** Worker → UI: resultado. `corners` = 8 floats (x,y × TL,TR,BR,BL) en
 *  fracciones 0–1, o null si no hay quad (stub T4: siempre null — F1 lo llena). */
export interface ResultReply {
  type: 'result';
  corners: Float32Array | null;
  qualityInput: RawQualityInput;
  /** Eco del ts del request (cálculo de latencia en UI). */
  ts: number;
}

/** Worker → UI: llegó un frame mientras procesaba → DESCARTADO (el descarte
 *  ES el mecanismo de backpressure; la UI además lo evita con su flag). */
export interface BusyReply {
  type: 'busy';
  ts: number;
}

/** Worker → UI: progreso de carga de OpenCV.js (importScripts es síncrono;
 *  solo hay hitos gruesos: 5% inicio, 100% queda cubierto por 'ready'). */
export interface BootMsg {
  type: 'boot';
  pct: number;
}

/** Worker → UI: OpenCV.js listo (onRuntimeInitialized). */
export interface ReadyMsg {
  type: 'ready';
}

/** Worker → UI: fallo (red al cargar opencv.js o excepción en pipeline). */
export interface ErrorMsg {
  type: 'error';
  message: string;
}

export type WorkerIn = DetectRequest;
export type WorkerOut = ResultReply | BusyReply | BootMsg | ReadyMsg | ErrorMsg;
