// src/workers/protocol.ts — contrato de mensajes UI ⇄ DetectionWorker (T4).
// Fijado por PLAN_MAESTRO §3 ("W"): requestVideoFrameCallback/ImageBitmap
// transferable → corners + score; backpressure por DESCARTE (nunca encolar).
// Vive en workers/ (no en core/) para no tocar la lógica aprobada de T2/T3.
// Corners en FRACCIONES (0–1) del frame, orden TL,TR,BR,BL — como el spike.

/** Resolución de proceso: el downscale a 480p ocurre en el ENVÍO (frameLoop
 *  vía createImageBitmap); el worker siempre recibe 480p listo. */
export const PROCESS_WIDTH = 640;
export const PROCESS_HEIGHT = 480;

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

/** Entrada cruda de calidad que el worker devuelve por frame (T4: valores
 *  CRUDOS — el QualityScorer del core los consume en F2, no se cablea aquí). */
export interface RawQualityInput {
  /** Varianza del Laplaciano sobre el frame 480p (stub: frame completo, sin
   *  crop — no hay quad hasta F1). null si no se pudo medir. */
  laplacianVar: number | null;
  frameW: number;
  frameH: number;
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
