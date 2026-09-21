// src/camera/CameraController.ts — selección, apertura y perfil de cámara (T5).
// F0 días 3-5 + hallazgos D2/D3. Reutiliza CameraProfile/CameraCapabilities de
// core/types.ts (SOLO lectura — prohibido modificar core/ aprobado).
// Testeable en Node: dependencias de medios inyectables (navegador real solo
// en los defaults). La verificación en dispositivo físico es HUMANA (AGENTS.md).

import type { CameraProfile } from '../core/types';

/** Capacidades medidas de UNA cámara (vía track abierto temporalmente). */
export interface CameraProbe {
  deviceId: string;
  label: string;
  focusModes: string[];
  torch: boolean;
  maxWidth: number;
  maxHeight: number;
}

export interface CameraChoice {
  probe: CameraProbe;
  /** Avisos no fatales (fallback fixed-focus, sin etiqueta back, etc.). */
  warnings: string[];
}

/** Presupuesto de píxeles del getUserMedia inicial (SIN ratio — disciplina
 *  T4.3: solo ancho ideal; el alto lo negocia el navegador). */
export const IDEAL_CAPTURE_WIDTH = 3840;

/** Etiqueta de cámara trasera (heurística de label; enumerateDevices no da
 *  facingMode — ver chooseMainCamera para el fallback documentado). */
const BACK_LABEL_RE = /back|rear|environment|trasera|posterior|arri[eè]re/i;

/** Modos de foco que cuentan como autofocus REAL (regla D3, T1-R4). */
const REAL_AF_MODES = new Set(['continuous', 'single-shot']);

export function hasRealAutofocus(focusModes: string[]): boolean {
  return focusModes.some((m) => REAL_AF_MODES.has(m.toLowerCase()));
}

/** Regla D3: traseras con autofocus real → desempate por max resolución.
 *  Sin AF en ninguna → fallback a la primera trasera + warning (fixed-focus).
 *  Sin etiquetas traseras → se consideran TODAS + warning (facingMode no está
 *  disponible pre-stream; documentado como último fallback). */
export function chooseMainCamera(probes: CameraProbe[]): CameraChoice | null {
  if (probes.length === 0) return null;
  const warnings: string[] = [];
  const backs = probes.filter((p) => BACK_LABEL_RE.test(p.label));
  const pool = backs.length > 0 ? backs : probes;
  if (backs.length === 0) {
    warnings.push('sin etiqueta trasera: se evalúan todas (facingMode no disponible pre-stream)');
  }
  const withAf = pool.filter((p) => hasRealAutofocus(p.focusModes));
  const byRes = (a: CameraProbe, b: CameraProbe) =>
    b.maxWidth * b.maxHeight - a.maxWidth * a.maxHeight;
  if (withAf.length > 0) {
    const best = [...withAf].sort(byRes)[0]!;
    return { probe: best, warnings };
  }
  const fallback = [...pool].sort(byRes)[0]!;
  warnings.push(`sin autofocus real: fallback a "${fallback.label}" (fixed-focus)`);
  return { probe: fallback, warnings };
}

export interface MediaDeps {
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  /** Abre la cámara solo para leer capabilities y la cierra (F0, una vez). */
  probeDevice(deviceId: string, label: string): Promise<CameraProbe>;
  now(): number;
}

export interface ControllerInit {
  /** deviceId preferido (salta la elección D3; útil para tests/harness). */
  deviceId?: string;
  video?: HTMLVideoElement;
}

function readCapsNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export class CameraController {
  private stream: MediaStream | null = null;
  private track: MediaStreamTrack | null = null;
  private profile: CameraProfile | null = null;
  readonly warnings: string[] = [];

  constructor(private readonly deps: MediaDeps) {}

  /** Defaults del navegador real. */
  static browser(): CameraController {
    return new CameraController({
      enumerateDevices: () => navigator.mediaDevices.enumerateDevices(),
      getUserMedia: (c) => navigator.mediaDevices.getUserMedia(c),
      probeDevice: async (deviceId, label) => {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
        try {
          const t = s.getVideoTracks()[0]!;
          const c = t.getCapabilities() as MediaTrackCapabilities & {
            focusMode?: string[];
            torch?: boolean;
            width?: { max?: number };
            height?: { max?: number };
          };
          return {
            deviceId,
            label: label || t.label,
            focusModes: Array.isArray(c.focusMode) ? c.focusMode : [],
            torch: c.torch === true,
            maxWidth: readCapsNumber(c.width?.max),
            maxHeight: readCapsNumber(c.height?.max),
          };
        } finally {
          for (const t of s.getTracks()) t.stop();
        }
      },
      now: () => Date.now(),
    });
  }

  async init(opts: ControllerInit = {}): Promise<CameraProfile> {
    const devices = await this.deps.enumerateDevices();
    const videos = devices.filter((d) => d.kind === 'videoinput');
    const probes: CameraProbe[] = [];
    for (const d of videos) {
      try {
        probes.push(await this.deps.probeDevice(d.deviceId, d.label));
      } catch {
        this.warnings.push(`probe falló para "${d.label || d.deviceId}": descartada`);
      }
    }
    let deviceId = opts.deviceId;
    if (deviceId === undefined) {
      const choice = chooseMainCamera(probes);
      if (choice === null) throw new Error('sin cámaras videoinput disponibles');
      this.warnings.push(...choice.warnings);
      deviceId = choice.probe.deviceId;
    }
    // Apertura con presupuesto de píxeles; fallbacks en cascada.
    const attempts: MediaStreamConstraints[] = [
      { video: { deviceId: { exact: deviceId }, width: { ideal: IDEAL_CAPTURE_WIDTH } } },
      { video: { deviceId: { exact: deviceId } } },
      { video: true },
    ];
    let lastErr: unknown = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        this.stream = await this.deps.getUserMedia(attempts[i]!);
        if (i > 0) this.warnings.push(`getUserMedia fallback nivel ${i} (sin presupuesto/sin deviceId)`);
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (this.stream === null) {
      throw new Error(`getUserMedia falló en 3 niveles: ${String(lastErr)}`);
    }
    const track = this.stream.getVideoTracks()[0];
    if (track === undefined) throw new Error('stream sin video track');
    this.track = track;
    if (opts.video !== undefined) opts.video.srcObject = this.stream;
    this.profile = this.buildProfile();
    return this.profile;
  }

  getProfile(): CameraProfile | null {
    return this.profile;
  }

  /** Re-lee getSettings()/getCapabilities (D2: llamar al girar el teléfono). */
  async refreshProfile(): Promise<CameraProfile> {
    if (this.track === null) throw new Error('refreshProfile sin init');
    this.profile = this.buildProfile();
    return this.profile;
  }

  /** Torch con degradación silenciosa (skill ios-camera-quirks). */
  async setTorch(on: boolean): Promise<'on' | 'off' | 'unsupported'> {
    if (this.track === null) return 'unsupported';
    const caps = this.track.getCapabilities() as MediaTrackCapabilities & {
      torch?: boolean;
    };
    if (caps.torch !== true) return 'unsupported';
    try {
      await this.track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      });
      return on ? 'on' : 'off';
    } catch {
      return 'unsupported';
    }
  }

  /** Re-perfila al cambiar orientación/tamaño (D2); devuelve desapuntador. */
  watchOrientation(cb: (profile: CameraProfile) => void): () => void {
    const handler = (): void => {
      this.refreshProfile().then(cb, () => {});
    };
    const so = window.screen.orientation;
    if (so !== undefined && so !== null) so.addEventListener('change', handler);
    window.addEventListener('resize', handler);
    return () => {
      if (so !== undefined && so !== null) so.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
    };
  }

  stop(): void {
    if (this.stream !== null) {
      for (const t of this.stream.getTracks()) t.stop();
    }
    this.stream = null;
    this.track = null;
  }

  private buildProfile(): CameraProfile {
    const track = this.track!;
    const s = track.getSettings();
    const c = track.getCapabilities() as MediaTrackCapabilities & {
      focusMode?: string[];
      torch?: boolean;
      zoom?: { max?: number };
    };
    const w = readCapsNumber(s.width);
    const h = readCapsNumber(s.height);
    return {
      deviceId: readCapsString(s.deviceId),
      label: track.label,
      trackWidth: w,
      trackHeight: h,
      aspectRatio: h > 0 ? w / h : 0,
      capabilities: {
        torch: c.torch === true,
        focusModes: Array.isArray(c.focusMode) ? c.focusMode : [],
        zoom: typeof c.zoom?.max === 'number' ? c.zoom.max : undefined,
      },
      capturedAt: this.deps.now(),
    };
  }
}

function readCapsString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
