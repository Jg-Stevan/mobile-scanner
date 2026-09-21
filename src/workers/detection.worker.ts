// src/workers/detection.worker.ts — Detección en vivo (PLAN_MAESTRO §5-F1, §3 "W").
//
// TODO (F1): QuadDetector sobre frame 480p (Canny + contornos + approxPolyDP),
// protocolo { type:'detect', bitmap } → { type:'result', corners, score } con
// backpressure (frames descartados si el worker está ocupado).
// OpenCV.js SOLO dentro de este Web Worker (AGENTS.md). Disciplina withMats()
// (todo cv.Mat .delete() en finally) + test de estrés 10 min.
// Sin implementación en T2.
export const DETECTION_WORKER_TODO =
  'QuadDetector 480p + protocolo transferable — F1, PLAN_MAESTRO §5-F1' as const;