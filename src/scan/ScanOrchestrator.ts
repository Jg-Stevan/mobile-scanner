// src/scan/ScanOrchestrator.ts — FSM + score en vivo + burst-rank + manual (F2).
// Consume quality.ts (APROBADO, sin editar) y scoring.ts puro. El worker SOLO
// manda crudos (prohibido tocar pipeline F1): el histograma de exposición se
// muestrea en el main thread (frame completo a ~160px, barato) porque el
// protocolo no lo trae — desviación documentada, consistente con la de
// revalidación (F3 aún no re-detecta el quad en la foto).
// Deps inyectables (patrón T5) → unit sin navegador. Sin setInterval.

import type { Quadrilateral, QualityScore } from '../core/types';
import {
  BLUR_THRESHOLD,
  SHUTTER_SPAN_MS,
  STABILITY_WINDOW_MS,
  computeEccentricityScore,
  computeExposureScore,
  computeSharpnessScore,
  computeStabilityScore,
  computeTotalScore,
  detectionTimedOut,
  shouldTriggerShutter,
} from '../core/quality';
import type { RawQualityInput } from '../workers/protocol';
import { computeProcessDims } from '../workers/protocol';
import { measureFrame, selectHint, underOverRatios } from './scoring';

export type ScanState = 'idle' | 'detecting' | 'capturing' | 'revalidating' | 'captured';

export type CaptureRouteTag = 'A' | 'B' | 'burst';

/** Candidato del burst: bitmap vivo + dims + ruta (el perdedor se cierra). */
export interface BurstCandidate {
  bitmap: ImageBitmap;
  w: number;
  h: number;
  route: CaptureRouteTag;
}

/** Foto ganadora: CRUDA + quad del stream como PRIOR (F3 la re-detecta). */
export interface CapturedPhoto {
  bitmap: ImageBitmap;
  quadPrior: Float32Array | null;
  frameW: number;
  frameH: number;
  revalScore: number;
  ts: number;
  route: CaptureRouteTag;
}

export interface ScoreView {
  total: number;
  hint: string | null;
  isBlur: boolean;
  state: ScanState;
}

export interface OrchestratorDeps {
  now(): number;
  /** Hist del frame actual para exposición (null si el video no está listo). */
  sampleExposure(): { hist: number[] } | null;
  /** 2 frames del stream a resolución del track (ruta B). */
  captureBurstFrames(n: number): Promise<BurstCandidate[]>;
  /** 1 takePhoto/drawImage hi-res (null si la ruta A no existe en el device). */
  capturePhoto(): Promise<BurstCandidate | null>;
  /** Downscale a 400-clase para revalidar (computeProcessDims). */
  downscale(bitmap: ImageBitmap, w: number, h: number): Promise<ImageData>;
  /** Feedback de plataforma: 'haptic' si vibró, 'none' si debe flashear UI. */
  notify(kind: 'captured' | 'timeout'): 'haptic' | 'none';
}

/** Gate de revalidación de exposición (F2, ingeniería — ver comentario). */
export const REVAL_MIN_EXPOSURE_SCORE = 0.5;
/** Cooldown post-captura anti doble-disparo (spec F2 Fase 3). */
export const CAPTURE_COOLDOWN_MS = 1500;
/** Ancho del sampler de exposición en main thread (barato, ~160px). */
export const EXPOSURE_SAMPLE_W = 160;

export interface OrchestratorEvents {
  onState(state: ScanState): void;
  onScore(score: ScoreView): void;
  onCaptured(photo: CapturedPhoto): void;
  onRetry(reason: string): void;
  onTimeout(): void;
}

interface QuadSample {
  t: number;
  quad: Quadrilateral;
}
interface ScoreSample {
  t: number;
  score: number;
}

function fractionsToQuad(c: Float32Array, w: number, h: number): Quadrilateral {
  return [
    { x: c[0]! * w, y: c[1]! * h },
    { x: c[2]! * w, y: c[3]! * h },
    { x: c[4]! * w, y: c[5]! * h },
    { x: c[6]! * w, y: c[7]! * h },
  ];
}

export interface OrchestratorOptions {
  video?: HTMLVideoElement;
  deps?: Partial<OrchestratorDeps>;
  events?: Partial<OrchestratorEvents>;
  cooldownMs?: number;
}

export class ScanOrchestrator {
  private readonly deps: OrchestratorDeps;
  private readonly events: OrchestratorEvents;
  private readonly cooldownMs: number;
  private state: ScanState = 'idle';
  private quadHistory: QuadSample[] = [];
  private scoreHistory: ScoreSample[] = [];
  private firstAttempt = 0;
  private lastExposureScore = 1;
  private cooldownTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCorners: Float32Array | null = null;

  constructor(opts: OrchestratorOptions = {}) {
    const video = opts.video;
    this.cooldownMs = opts.cooldownMs ?? CAPTURE_COOLDOWN_MS;
    this.deps = {
      now: () => performance.now(),
      sampleExposure: () => {
        if (video === undefined || video.videoWidth === 0) return null;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        // F2-a Fix 1: histograma sobre el CROP del quad del stream (bbox +
        // 5% de margen; lastCorners se actualiza antes de muestrear, así que
        // es el quad del frame actual) — el frame completo hunde la exposición
        // con fondos oscuros (falso "Muy oscuro" del acta densa). Sin quad →
        // frame completo (comportamiento anterior).
        let sx = 0;
        let sy = 0;
        let sw = vw;
        let sh = vh;
        const qc = this.lastCorners;
        if (qc !== null && qc.length === 8) {
          let minX = 1;
          let minY = 1;
          let maxX = 0;
          let maxY = 0;
          let ok = true;
          for (let i = 0; i < 4; i++) {
            const x = qc[2 * i]!;
            const y = qc[2 * i + 1]!;
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
              ok = false;
              break;
            }
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
          if (ok && maxX > minX && maxY > minY) {
            const mx = 0.05 * vw;
            const my = 0.05 * vh;
            sx = Math.max(0, Math.floor(minX * vw - mx));
            sy = Math.max(0, Math.floor(minY * vh - my));
            sw = Math.max(1, Math.min(vw, Math.ceil(maxX * vw + mx)) - sx);
            sh = Math.max(1, Math.min(vh, Math.ceil(maxY * vh + my)) - sy);
          }
        }
        const w = EXPOSURE_SAMPLE_W;
        const h = Math.max(1, Math.round((sh / sw) * w));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx === null) return null;
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
        const d = ctx.getImageData(0, 0, w, h);
        const hist = new Array<number>(256).fill(0);
        for (let i = 0; i < d.data.length; i += 4) {
          hist[(d.data[i]! * 77 + d.data[i + 1]! * 150 + d.data[i + 2]! * 29) >> 8]! += 1;
        }
        return { hist };
      },
      captureBurstFrames: async (n: number) => {
        if (video === undefined) throw new Error('burst sin video');
        const out: BurstCandidate[] = [];
        for (let k = 0; k < n; k++) {
          const w = video.videoWidth;
          const h = video.videoHeight;
          const bitmap = await createImageBitmap(video);
          out.push({ bitmap, w, h, route: 'B' });
        }
        return out;
      },
      capturePhoto: async () => null,
      downscale: async (bitmap: ImageBitmap, w: number, h: number) => {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (ctx === null) throw new Error('downscale: ctx null');
        ctx.drawImage(bitmap, 0, 0, w, h);
        return ctx.getImageData(0, 0, w, h);
      },
      notify: (kind: 'captured' | 'timeout') => {
        if (kind === 'timeout') return 'none'; // F2-b: vibración SOLO en captura (antes vibraba también en timeout cada 8s → indistinguible; toast ya avisa)
        try {
          const nav = navigator as Navigator & { vibrate?: (p: number) => boolean };
          if (typeof nav.vibrate === 'function' && nav.vibrate(50)) return 'haptic';
        } catch {
          // iOS: sin vibrate → la UI flashea el overlay (skill ios-camera-quirks)
        }
        return 'none';
      },
      ...opts.deps,
    };
    const noop = (): void => {};
    this.events = {
      onState: noop,
      onScore: noop,
      onCaptured: noop,
      onRetry: noop,
      onTimeout: noop,
      ...opts.events,
    };
  }

  getState(): ScanState {
    return this.state;
  }

  start(): void {
    this.stopTimer();
    this.setState('detecting');
    this.firstAttempt = this.deps.now();
    this.quadHistory = [];
    this.scoreHistory = [];
    this.lastCorners = null; // sin quad heredado (el sampler arranca full-frame)
  }

  stop(): void {
    this.stopTimer();
    this.setState('idle');
  }

  /** Dispara el timeout de no-detección: 8s sin quad → toast. F2-b: sin
   *  vibración (solo visual — vibrar en timeout cada 8s era indistinguible de
   *  la captura y el humano lo reportó como confusión). */
  onWorkerResult(q: RawQualityInput, corners: Float32Array | null, ts: number): void {
    if (this.state !== 'detecting') return;
    this.lastCorners = corners;

    const lapVar = q.laplacianVar ?? 0;
    const sharpness = computeSharpnessScore(lapVar);

    const sample = this.deps.sampleExposure();
    let exposureScore = this.lastExposureScore;
    let specularWarn = false;
    let under = 0;
    let over = 0;
    if (sample !== null) {
      const e = computeExposureScore(sample.hist);
      exposureScore = e.score;
      specularWarn = e.specularWarn;
      this.lastExposureScore = e.score;
      ({ under, over } = underOverRatios(sample.hist));
    }

    const now = this.deps.now();
    if (corners !== null) {
      this.quadHistory.push({ t: ts, quad: fractionsToQuad(corners, q.frameW, q.frameH) });
    }
    this.quadHistory = this.quadHistory.filter((s) => now - s.t <= STABILITY_WINDOW_MS + 200);
    const stability = computeStabilityScore(this.quadHistory, ts);

    const eccentricity =
      corners !== null ? computeEccentricityScore(fractionsToQuad(corners, q.frameW, q.frameH), q.frameW, q.frameH) : null;

    const total: QualityScore = computeTotalScore(
      { sharpness, exposure: exposureScore, stability, eccentricity },
      lapVar,
      0,
    );
    this.scoreHistory.push({ t: ts, score: total.total });
    this.scoreHistory = this.scoreHistory.filter((s) => now - s.t <= SHUTTER_SPAN_MS + 200);

    const hint = selectHint({
      hasQuad: corners !== null,
      eccentricity,
      specularWarn,
      underRatio: under,
      overRatio: over,
      stability,
    });
    this.events.onScore({ total: total.total, hint, isBlur: total.isBlur, state: this.state });

    if (shouldTriggerShutter(this.scoreHistory)) {
      void this.runBurst();
      return;
    }
    if (detectionTimedOut(this.firstAttempt, ts)) {
      this.firstAttempt = ts; // re-armar: un toast cada 8s, no spam
      this.deps.notify('timeout');
      this.events.onTimeout();
    }
  }

  /** Botón manual: misma ruta burst+revalidación; funciona sin quad. */
  async captureManual(): Promise<'captured' | 'retry' | 'busy'> {
    if (this.state !== 'detecting') return 'busy';
    return this.runBurst();
  }

  private setState(s: ScanState): void {
    this.state = s;
    this.events.onState(s);
  }

  private stopTimer(): void {
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  private async runBurst(): Promise<'captured' | 'retry'> {
    this.setState('capturing');
    let frames: BurstCandidate[] = [];
    try {
      frames = await this.deps.captureBurstFrames(2);
    } catch {
      frames = [];
    }
    let photo: BurstCandidate | null = null;
    try {
      photo = await this.deps.capturePhoto();
    } catch {
      photo = null;
    }
    this.setState('revalidating');
    // Revalidación en orden de llegada: takePhoto primero si existe.
    const ordered = photo !== null ? [photo, ...frames] : frames;
    let best: { c: BurstCandidate; score: number } | null = null;
    let photoPass: { c: BurstCandidate; score: number } | null = null;
    for (const c of ordered) {
      let s: { pass: boolean; score: number };
      try {
        s = await this.revalidate(c);
      } catch {
        s = { pass: false, score: -1 }; // candidato corrupto: pierde, no mata el burst
      }
      if (s.pass) {
        const entry = { c, score: s.score };
        if (best === null || s.score > best.score) best = entry;
        if (c === photo) photoPass = entry;
      }
    }
    const winner = photoPass ?? best;
    // Cerrar perdedores INMEDIATAMENTE (pico de memoria acotado).
    for (const c of ordered) {
      if (winner === null || c !== winner.c) {
        try {
          c.bitmap.close();
        } catch {
          // ya cerrado: nada
        }
      }
    }
    if (winner === null) {
      this.firstAttempt = this.deps.now();
      this.setState('detecting');
      this.events.onRetry('reintentando…');
      return 'retry';
    }
    this.setState('captured');
    this.deps.notify('captured');
    this.events.onCaptured({
      bitmap: winner.c.bitmap,
      quadPrior: this.lastCorners,
      frameW: winner.c.w,
      frameH: winner.c.h,
      revalScore: winner.score,
      ts: this.deps.now(),
      route: winner.c.route,
    });
    this.stopTimer();
    this.cooldownTimer = setTimeout(() => {
      this.cooldownTimer = null;
      if (this.state === 'captured') {
        this.firstAttempt = this.deps.now();
        this.scoreHistory = [];
        this.setState('detecting');
      }
    }, this.cooldownMs);
    return 'captured';
  }

  /** Revalidación sobre frame completo a 400-clase (F3 aún no re-detecta el
   *  quad en la foto — desviación documentada del contrato "crop"; el
   *  documento domina el encuadre). Pass = gate de nitidez BLUR_THRESHOLD
   *  (aprobado) + gate de exposición REVAL_MIN_EXPOSURE_SCORE (ingeniería F2).
   *  Score = lapVar normalizado para ranking (mayor = mejor). */
  private async revalidate(
    c: BurstCandidate,
  ): Promise<{ pass: boolean; score: number }> {
    const dims = computeProcessDims(c.w, c.h, 'preserve');
    const id = await this.deps.downscale(c.bitmap, dims.w, dims.h);
    const m = measureFrame(id);
    const e = computeExposureScore(m.hist);
    const pass = m.laplacianVar >= BLUR_THRESHOLD && e.score >= REVAL_MIN_EXPOSURE_SCORE;
    return { pass, score: m.laplacianVar };
  }
}
