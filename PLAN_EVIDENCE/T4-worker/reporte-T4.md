# Evidencia T4 — Web Worker de detección (protocolo, backpressure, memoria)

Fecha: 2026-09-21 · Precondición: T3-b en baseline (`17d0862`).
Skill aplicada: `opencv-wasm-memoria` (withMats + estrés).

## Alcance entregado (esqueleto funcional, §3 "W" sin algoritmo F1)
- `src/workers/withMats.ts` — wrapper LIFO con `finally` (puro, testeado).
- `src/workers/protocol.ts` — contrato fijo: detect{bitmap transferable, ts} →
  result{corners Float32Array(8)|null en fracciones, qualityInput cruda, ts} +
  busy/boot/ready/error. Descarte = backpressure. Protocolo en workers/ no en
  core/ (decisión: no tocar tipos aprobados T2/T3).
- `src/workers/pipeline.ts` — preproceso REAL 480p (gray→blur→Canny 50/150→
  contornos→Laplaciano+meanStdDev), corners=null (stub documentado, F1 lo llena),
  qualityInput.laplacianVar cruda. cv inyectado como CvApi (mock en tests).
- `src/workers/detection.worker.ts` — CLASSIC worker (importScripts, sin CORS)
  + Module.onRuntimeInitialized → ready; OffscreenCanvas por frame; bitmap.close
  en finally; busy flag con descarte. OPENCV_CDN_URL pineado a 4.5.5 (4.10.0 da
  404 en ese path — verificado con curl).
- `src/camera/frameLoop.ts` — rVFC con fallback rAF, createImageBitmap
  resize 640×480 'low', envío solo si libre (flag result/busy, sin cola),
  stats {sent, dropped}, stop() cancela + terminate. Deps inyectables (tests).

## Correcciones durante la implementación (documentadas, no silenciosas)
1. Vite dev sirve el worker como ESM → classic worker fallaba ("import outside
   module"); el intento module-worker chocó con CORS del CDN en fetch. Rige:
   CLASSIC worker + importScripts, verificado vía build prod.
2. Harness en RAÍZ (no /public): los .html de /public se sirven raw sin
   transform TS; en raíz Vite procesa los imports. Temporal: se borra tras el E2E.
3. `vite.config.ts` coverage.include += withMats/pipeline/frameLoop
   (detection.worker.ts excluido: no corre en Node — lo cubre el E2E).

## Verificación
- Unit: 65/65 (17 nuevos T4: withMats LIFO/throw/early, pipeline mock
  creados==destruidos incl. Canny-lanza, backpressure UI, defaults rVFC/rAF,
  stop-cierra-bitmap). tsc limpio.
- Coverage: frameLoop/pipeline/withMats 100% líneas; quality 100%; geometry 94.69%.
- E2E 62s (build prod + cámara fake 640×480, `e2e-60s.json`):
  boot opencv.js 4.4s · worker **11.5 FPS** (budget ≥10 ✓ — línea base para F1) ·
  sent 712 / dropped 404 (descarte por diseño) · rAF main **58.4 FPS** (≥50 ✓) ·
  heap 4.24→3.52MB **−17%** (sin tendencia creciente ✓ <20%) ·
  laplacianVar mediana 65.5 (fake cam real).

## Prohibiciones respetadas
- Sin QuadDetector final ni QualityScorer en el worker (solo crudos).
- Sin setInterval (rVFC/rAF). Sin tocar spike.html, tests/bench/, core/.
- Estrés completo 10min del skill: diferido a F1 (el worker cambia con el
  detector real); 62s + conteo create/delete en unit cubren T4.

## Adjudicación /ship (desacuerdo revisor vs revisor-b → juzga orquestador)
- Revisor: APROBADO (verificación línea por línea, sin bloqueantes).
- Revisor-b: CHANGES_REQUESTED con 2 findings — AMBOS DESESTIMADOS:
  1. "PROCESS_WIDTH/HEIGHT hardcodea aspect ratio": NO. El spec T4 aprobado por
     el humano EXIGE `resizeWidth: 640, resizeHeight: 480`; es presupuesto de
     proceso (307k px), no suposición del sensor; corners=null y a futuro las
     fracciones son invariantes de aspecto (scaleQuad anisotrópico existe para
     el mapeo F1); FrameLoopOptions ya admite width/height (CameraProfile los
     alimentará en F0). Sin cambio.
  2. "e2e-60s.json ausente en raíz": el reporte dice PLAN_EVIDENCE/T4-worker/
     (verificado: el archivo existe con los números citados). Sin cambio.
- Veredicto final: APROBADO (1 a favor detallado + 2 findings refutados).
