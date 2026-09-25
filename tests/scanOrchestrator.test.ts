// tests/scanOrchestrator.test.ts — FSM + burst-rank + manual + cooldown (F2).
// Deps totalmente inyectadas (reloj manual, bitmaps falsos, downscale en cola).
import { describe, expect, it, vi } from 'vitest';

import type { OrchestratorDeps } from '../src/scan/ScanOrchestrator';
import { CAPTURE_COOLDOWN_MS, ScanOrchestrator } from '../src/scan/ScanOrchestrator';
import { assembleRefinedQuad, needsEditorReview } from '../src/scan/cornerRefiner';
import type { Quadrilateral } from '../src/core/types';
import type { DetectRequest, RawQualityInput, WarpRequest } from '../src/workers/protocol';

function fakeBitmap(): ImageBitmap & { closed: boolean } {
  const b = {
    closed: false,
    width: 640,
    height: 480,
    close: vi.fn(() => {
      b.closed = true;
    }),
  } as unknown as ImageBitmap & { closed: boolean };
  return b;
}

/** ImageData gris plano / tablero nítido 32×32. */
function gray(v: number): ImageData {
  const data = new Uint8ClampedArray(32 * 32 * 4).fill(0);
  for (let i = 0; i < 32 * 32; i++) {
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: 32, height: 32, data } as ImageData;
}
/** Documento sintético: fondo 200 + líneas negras (nítido, bien expuesto). */
function docSharp(): ImageData {
  const W = 64;
  const H = 64;
  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = y % 8 === 0 ? 0 : 200;
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width: W, height: H, data } as ImageData;
}

const GOOD_HIST = (() => {
  const h = new Array<number>(256).fill(0);
  h[128] = 1000;
  return h;
})();

const CENTERED = new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]);

function setup(over: Partial<OrchestratorDeps> = {}) {
  let now = 0;
  const events = {
    states: [] as string[],
    scores: [] as Array<{ total: number; hint: string | null }>,
    captured: [] as unknown[],
    retries: [] as string[],
    timeouts: 0,
  };
  const deps: OrchestratorDeps = {
    now: () => now,
    sampleExposure: () => ({ hist: [...GOOD_HIST] }),
    captureBurstFrames: async () => [
      { bitmap: fakeBitmap(), w: 640, h: 480, route: 'B' },
      { bitmap: fakeBitmap(), w: 640, h: 480, route: 'B' },
    ],
    capturePhoto: async () => ({ bitmap: fakeBitmap(), w: 3000, h: 4000, route: 'A' }),
    downscale: async () => docSharp(),
    photoProcessBitmap: async () => fakeBitmap(),
    detectPhoto: async () => null,
    requestWarp: async () => null,
    notify: () => 'haptic',
    ...over,
  };
  const ctl = new ScanOrchestrator({
    deps,
    events: {
      onState: (s) => events.states.push(s),
      onScore: (s) => events.scores.push({ total: s.total, hint: s.hint }),
      onCaptured: (p) => events.captured.push(p),
      onRetry: (r) => events.retries.push(r),
      onTimeout: () => events.timeouts++,
    },
    cooldownMs: 30,
  });
  const q: RawQualityInput = {
    laplacianVar: 500,
    cropMean: 128,
    cropStdDev: 20,
    frameW: 640,
    frameH: 480,
  };
  return {
    ctl,
    events,
    q,
    setNow: (t: number) => {
      now = t;
    },
    feed: (ts: number, corners: Float32Array | null = CENTERED, qq: RawQualityInput = q) => {
      now = ts;
      ctl.onWorkerResult(qq, corners, ts);
    },
  };
}

describe('FSM + auto-shutter por racha', () => {
  it('estable >0.8 durante 600ms → capturing → captured → cooldown → detecting', async () => {
    const t = setup();
    t.ctl.start();
    expect(t.ctl.getState()).toBe('detecting');
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('captured');
    expect(t.events.captured).toHaveLength(1);
    const photo = t.events.captured[0] as { route: string; quadPrior: Float32Array | null };
    expect(photo.route).toBe('A'); // takePhoto nítida gana
    expect(photo.quadPrior).not.toBeNull();
    expect(t.events.states).toEqual(['detecting', 'capturing', 'revalidating', 'captured']);
    await new Promise((r) => setTimeout(r, 60));
    expect(t.ctl.getState()).toBe('detecting'); // cooldown corto de test
  });
  it('racha corta (250ms) → NO dispara', async () => {
    const t = setup();
    t.ctl.start();
    for (const ts of [0, 100, 250]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('detecting');
    expect(t.events.captured).toHaveLength(0);
  });
  it('score bajo (borroso) nunca dispara; total < 0.8', async () => {
    const t = setup();
    t.ctl.start();
    for (const ts of [0, 100, 200, 310, 500]) {
      t.feed(ts, CENTERED, { ...t.q, laplacianVar: 20 });
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('detecting');
    expect(t.events.scores.length).toBeGreaterThan(0);
    expect(t.events.scores[0]!.total).toBeLessThan(0.8);
  });
});

describe('burst-rank', () => {
  it('takePhoto borrosa + frame nítido → gana el frame; perdedores cerrados', async () => {
    const photoBmp = fakeBitmap();
    const f1 = fakeBitmap();
    const f2 = fakeBitmap();
    const downs = [gray(128), docSharp(), docSharp()]; // photo, f1, f2
    const t = setup({
      capturePhoto: async () => ({ bitmap: photoBmp, w: 3000, h: 4000, route: 'A' }),
      captureBurstFrames: async () => [
        { bitmap: f1, w: 640, h: 480, route: 'B' },
        { bitmap: f2, w: 640, h: 480, route: 'B' },
      ],
      downscale: (async () => downs.shift() ?? docSharp()) as OrchestratorDeps['downscale'],
    });
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    const photo = t.events.captured[0] as { route: string; bitmap: ImageBitmap };
    expect(photo.route).toBe('B');
    expect(photoBmp.closed).toBe(true); // perdedora cerrada
    expect(f1.closed).toBe(false); // ganadora viva
    expect(f2.closed).toBe(true);
  });
  it('ninguno pasa → retry + detecting + onRetry', async () => {
    const t = setup({
      downscale: (async () => gray(10)) as OrchestratorDeps['downscale'],
    });
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('detecting');
    expect(t.events.retries).toEqual(['reintentando…']);
    expect(t.events.captured).toHaveLength(0);
  });
});

describe('manual + escapes + cooldown', () => {
  it('manual sin quad → captura con quadPrior null', async () => {
    const t = setup();
    t.ctl.start();
    t.feed(0, null);
    expect(await t.ctl.captureManual()).toBe('captured');
    const photo = t.events.captured[0] as { quadPrior: Float32Array | null };
    expect(photo.quadPrior).toBeNull();
  });
  it('manual en idle/captured → busy; cooldown reabre detecting', async () => {
    const t = setup();
    expect(await t.ctl.captureManual()).toBe('busy');
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('captured');
    expect(await t.ctl.captureManual()).toBe('busy'); // cooldown
    await new Promise((r) => setTimeout(r, 60));
    expect(t.ctl.getState()).toBe('detecting');
  });
  it('8s sin detección válida → timeout (re-armado, sin spam de estados)', async () => {
    const t = setup();
    t.ctl.start();
    t.feed(0, null);
    t.feed(8100, null);
    expect(t.events.timeouts).toBe(1);
    expect(t.ctl.getState()).toBe('detecting');
    t.feed(9000, null);
    expect(t.events.timeouts).toBe(1); // re-armado a 8100+8000
  });
  it('F2-b: timeout NO vibra (solo toast) — distingue de captura', async () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const hist = new Array<number>(256).fill(0);
    hist[128] = 1000;
    let now = 0;
    const ctl = new ScanOrchestrator({
      deps: { now: () => now, sampleExposure: () => ({ hist }) },
      cooldownMs: 10,
    });
    ctl.start();
    const q: RawQualityInput = { laplacianVar: 20, cropMean: 128, cropStdDev: 20, frameW: 640, frameH: 480 };
    now = 0;
    ctl.onWorkerResult(q, null, 0);
    now = 8100;
    ctl.onWorkerResult(q, null, 8100);
    expect(vibrate).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it('excentricidad mala → hint "Centra el documento" en onScore', async () => {
    const t = setup();
    t.ctl.start();
    const edge = new Float32Array([0.0, 0.2, 0.9, 0.2, 0.9, 0.8, 0.0, 0.8]);
    t.feed(0, edge);
    expect(t.events.scores[0]!.hint).toBe('Centra el documento');
  });
  it('sampleExposure null → reutiliza última exposición (no rompe)', async () => {
    const t = setup({ sampleExposure: () => null });
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
    expect(t.ctl.getState()).toBe('captured');
  });
  it(`cooldown por defecto ${CAPTURE_COOLDOWN_MS}ms`, () => {
    expect(CAPTURE_COOLDOWN_MS).toBe(1500);
  });
});

describe('defaults de navegador (stubs DOM, vía flujos públicos)', () => {
  /** ImageData gris 200 con filas negras (pasa revalidación). */
  function docLike(w: number, h: number) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = y % 8 === 0 ? 0 : 200;
        const i = (y * w + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    return { width: w, height: h, data };
  }
  function stubDocument(w: number, h: number) {
    const id = docLike(w, h);
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: () => {},
          getImageData: () => id,
        }),
      })),
    });
  }

  it('sampleExposure + burst + downscale defaults: shutter→captured ruta B', async () => {
    stubDocument(160, 120);
    const bmp = fakeBitmap();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp));
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    const captured: unknown[] = [];
    // capturePhoto default → null (sin inyectar): gana el mejor frame del burst
    let now = 0;
    const ctl = new ScanOrchestrator({
      video,
      deps: { now: () => now },
      events: { onCaptured: (p) => captured.push(p) },
      cooldownMs: 10,
    });
    ctl.start();
    const q: RawQualityInput = {
      laplacianVar: 500,
      cropMean: 128,
      cropStdDev: 20,
      frameW: 640,
      frameH: 480,
    };
    for (const ts of [0, 100, 200, 400, 600, 700]) {
      now = ts;
      ctl.onWorkerResult(q, CENTERED, ts);
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(captured).toHaveLength(1);
    expect((captured[0] as { route: string }).route).toBe('B');
    expect(vibrate).toHaveBeenCalledWith(50); // notify → haptic
    vi.unstubAllGlobals();
  });

  it('notify sin vibrate (iOS) → none y captura igual', async () => {
    stubDocument(160, 120);
    const bmp = fakeBitmap();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bmp));
    vi.stubGlobal('navigator', {});
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    const captured: unknown[] = [];
    const ctl = new ScanOrchestrator({
      video,
      events: { onCaptured: (p) => captured.push(p) },
      cooldownMs: 10,
    });
    ctl.start();
    const r = await ctl.captureManual();
    expect(r).toBe('captured');
    expect(captured).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('sampleExposure null sin video listo → expone última (no rompe)', async () => {
    const video = { videoWidth: 0, videoHeight: 0 } as HTMLVideoElement;
    const ctl = new ScanOrchestrator({ video, cooldownMs: 10 });
    ctl.start();
    const q: RawQualityInput = {
      laplacianVar: 500,
      cropMean: 128,
      cropStdDev: 20,
      frameW: 640,
      frameH: 480,
    };
    ctl.onWorkerResult(q, CENTERED, 0);
    expect(ctl.getState()).toBe('detecting');
  });

  it('F2-a Fix1: sampler usa el crop del quad (bbox + 5%), no el frame', () => {
    const draws: unknown[][] = [];
    const id = { width: 160, height: 120, data: new Uint8ClampedArray(160 * 120 * 4).fill(128) };
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: (...a: unknown[]) => draws.push(a),
          getImageData: () => id,
        }),
      })),
    });
    let now = 0;
    const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
    const ctl = new ScanOrchestrator({ video, deps: { now: () => now }, cooldownMs: 10 });
    ctl.start();
    const q: RawQualityInput = {
      laplacianVar: 500,
      cropMean: 128,
      cropStdDev: 20,
      frameW: 640,
      frameH: 480,
    };
    ctl.onWorkerResult(q, null, 0); // sin quad → frame completo
    expect(draws[0]!.slice(1, 5)).toEqual([0, 0, 640, 480]);
    now = 100;
    ctl.onWorkerResult(q, CENTERED, 100); // con quad → crop (quad actual, sin lag)
    // bbox .1-.9 de 640×480 + 5%: x 64..576±32 → 32..608; y 48..432±24 → 24..456
    expect(draws[1]!.slice(1, 5)).toEqual([32, 24, 576, 432]);
    expect(draws[1]!.slice(5, 9)).toEqual([0, 0, 160, 120]);
    vi.unstubAllGlobals();
  });
});

describe('F3-a: re-detección sobre la foto', () => {
  const PHOTO_QUAD = new Float32Array([0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75]);

  function procBitmap(w: number, h: number): ImageBitmap {
    const b = fakeBitmap();
    (b as unknown as { width: number }).width = w;
    (b as unknown as { height: number }).height = h;
    return b as unknown as ImageBitmap;
  }

  function setupF3a(
    over: Partial<OrchestratorDeps> = {},
    detectImpl: (req: DetectRequest) => Promise<Float32Array | null> = async () => PHOTO_QUAD,
  ) {
    const posted: DetectRequest[] = [];
    const resized: Array<{ w: number; h: number }> = [];
    const downs: Array<{ bitmap: ImageBitmap; w: number; h: number }> = [];
    const photoBmp = fakeBitmap();
    const t = setup({
      capturePhoto: async () => ({ bitmap: photoBmp, w: 3000, h: 4000, route: 'A' }),
      downscale: (async (bitmap: ImageBitmap, w: number, h: number) => {
        downs.push({ bitmap, w, h });
        return docSharp();
      }) as OrchestratorDeps['downscale'],
      photoProcessBitmap: (async (_bitmap: ImageBitmap, w: number, h: number) => {
        resized.push({ w, h });
        return procBitmap(w, h);
      }) as OrchestratorDeps['photoProcessBitmap'],
      detectPhoto: (async (req: DetectRequest) => {
        posted.push(req);
        return detectImpl(req);
      }) as OrchestratorDeps['detectPhoto'],
      ...over,
    });
    return { ...t, posted, resized, downs, photoBmp };
  }

  async function trigger(t: { ctl: ScanOrchestrator; feed: (ts: number) => void }): Promise<void> {
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
  }

  type PhotoOut = {
    quad: Array<{ x: number; y: number }> | null;
    quadPrior: Float32Array | null;
    needsEditorReview: boolean;
  };

  /** Igualdad de quads con tolerancia (las fracciones viajan en Float32Array). */
  function expectQuadClose(
    actual: Array<{ x: number; y: number }> | null,
    expected: Array<[number, number]>,
  ): void {
    expect(actual).not.toBeNull();
    expect(actual).toHaveLength(4);
    for (let i = 0; i < 4; i++) {
      expect(actual![i]!.x).toBeCloseTo(expected[i]![0], 3);
      expect(actual![i]!.y).toBeCloseTo(expected[i]![1], 3);
    }
  }

  it('disparo → foto a 400-clase (300×400) y DetectRequest al worker', async () => {
    const t = setupF3a();
    await trigger(t);
    expect(t.ctl.getState()).toBe('captured');
    expect(t.resized).toEqual([{ w: 300, h: 400 }]); // foto 3000×4000, lado mayor → 400
    expect(t.posted).toHaveLength(1);
    expect(t.posted[0]!.type).toBe('detect');
    expect(t.posted[0]!.bitmap.width).toBe(300);
    expect(t.posted[0]!.bitmap.height).toBe(400);
    expect(Number.isFinite(t.posted[0]!.ts)).toBe(true);
  });

  it('revalidación final mide el downscale de la FOTO (ranking + gate final)', async () => {
    const t = setupF3a();
    await trigger(t);
    // foto 3000×4000 → 300×400 (ranking + gate final); frames 640×480 → 400×300
    expect(t.downs.filter((d) => d.bitmap === t.photoBmp && d.w === 300 && d.h === 400)).toHaveLength(2);
    expect(t.downs.filter((d) => d.w === 400 && d.h === 300)).toHaveLength(2);
  });

  it('sin quad en foto → prior del stream escalado a la foto + needsEditorReview', async () => {
    const t = setupF3a({}, async () => null);
    await trigger(t); // feed CENTERED por defecto (stream 640×480)
    expect(t.ctl.getState()).toBe('captured');
    const photo = t.events.captured[0] as PhotoOut;
    expect(photo.needsEditorReview).toBe(true);
    expect(photo.quadPrior).not.toBeNull();
    // CENTERED (0.1…0.9) × foto 3000×4000
    expectQuadClose(photo.quad, [
      [300, 400],
      [2700, 400],
      [2700, 3600],
      [300, 3600],
    ]);
  });

  it('gate final sobre la foto fail → detecting + retry (ganadora cerrada)', async () => {
    const photoBmp = fakeBitmap();
    const queue = [docSharp(), docSharp(), docSharp(), gray(10)]; // ranking ×3 pass, foto fail
    const t = setupF3a({
      capturePhoto: async () => ({ bitmap: photoBmp, w: 3000, h: 4000, route: 'A' }),
      downscale: (async () => queue.shift() ?? docSharp()) as OrchestratorDeps['downscale'],
    });
    await trigger(t);
    expect(t.ctl.getState()).toBe('detecting');
    expect(t.events.retries).toEqual(['reintentando…']);
    expect(t.events.captured).toHaveLength(0);
    expect(photoBmp.closed).toBe(true);
  });

  it('quad de foto presente → needsEditorReview=false y prior registrado', async () => {
    const t = setupF3a();
    await trigger(t);
    const photo = t.events.captured[0] as PhotoOut;
    expect(photo.needsEditorReview).toBe(false);
    expect(photo.quadPrior).not.toBeNull();
    // PHOTO_QUAD × foto 3000×4000
    expectQuadClose(photo.quad, [
      [600, 1000],
      [2400, 1000],
      [2400, 3000],
      [600, 3000],
    ]);
  });

  it('detectPhoto rechaza → fallback al prior sin romper', async () => {
    const t = setupF3a({}, async () => {
      throw new Error('worker caído');
    });
    await trigger(t);
    expect(t.ctl.getState()).toBe('captured');
    const photo = t.events.captured[0] as PhotoOut;
    expect(photo.needsEditorReview).toBe(true);
    expect(photo.quad).not.toBeNull();
  });
});

describe('F3-c: warp final de la foto', () => {
  const PHOTO_QUAD = new Float32Array([0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75]);

  type WarpOut = {
    bitmap: ImageBitmap;
    w: number;
    h: number;
    refinedQuad: Float32Array | null;
    refined: boolean;
    fellBack: [boolean, boolean, boolean, boolean] | null;
  };
  type CapturedF3c = {
    quad: Array<{ x: number; y: number }> | null;
    warped: (ImageBitmap & { closed: boolean }) | null;
    warpW: number;
    warpH: number;
  };

  function setupF3c(
    over: Partial<OrchestratorDeps> = {},
    warpImpl: (req: WarpRequest) => Promise<WarpOut | null> = async () => ({
      bitmap: fakeBitmap(),
      w: 1800,
      h: 2000,
      refinedQuad: null,
      refined: false,
      fellBack: null,
    }),
  ) {
    const warps: WarpRequest[] = [];
    const photoBmp = fakeBitmap();
    const t = setup({
      capturePhoto: async () => ({ bitmap: photoBmp, w: 3000, h: 4000, route: 'A' }),
      downscale: async () => docSharp(),
      photoProcessBitmap: async () => fakeBitmap(),
      detectPhoto: async () => PHOTO_QUAD,
      requestWarp: (async (req: WarpRequest) => {
        warps.push(req);
        return warpImpl(req);
      }) as OrchestratorDeps['requestWarp'],
      ...over,
    });
    return { ...t, warps, photoBmp };
  }

  async function trigger(t: { ctl: ScanOrchestrator; feed: (ts: number) => void }): Promise<void> {
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
  }

  it('tras el quad de foto → WarpRequest (bitmap ganador + quad en fracciones)', async () => {
    const t = setupF3c();
    await trigger(t);
    expect(t.ctl.getState()).toBe('captured');
    expect(t.warps).toHaveLength(1);
    expect(t.warps[0]!.type).toBe('warp');
    expect(t.warps[0]!.bitmap).toBe(t.photoBmp);
    expect(Array.from(t.warps[0]!.quad)).toEqual(Array.from(PHOTO_QUAD));
    expect(Number.isFinite(t.warps[0]!.ts)).toBe(true);
  });

  it('warped expuesto en onCaptured (bitmap + dims del worker)', async () => {
    const t = setupF3c();
    await trigger(t);
    const photo = t.events.captured[0] as CapturedF3c;
    expect(photo.warped).not.toBeNull();
    expect(photo.warped!.closed).toBe(false);
    expect(photo.warpW).toBe(1800);
    expect(photo.warpH).toBe(2000);
  });

  it('warp caído (throw) → warped null y la captura SIGUE (sin reintento)', async () => {
    const t = setupF3c({}, async () => {
      throw new Error('warp caído');
    });
    await trigger(t);
    expect(t.ctl.getState()).toBe('captured');
    const photo = t.events.captured[0] as CapturedF3c;
    expect(photo.warped).toBeNull();
    expect(photo.warpW).toBe(0);
    expect(photo.warpH).toBe(0);
    expect(t.events.retries).toEqual([]);
  });

  it('warp null (sin worker) → warped null y captured igual', async () => {
    const t = setupF3c({}, async () => null);
    await trigger(t);
    expect(t.ctl.getState()).toBe('captured');
    expect((t.events.captured[0] as CapturedF3c).warped).toBeNull();
  });

  it('sin quad (ni foto ni prior) → warp NI SE PIDE', async () => {
    const t = setupF3c({ detectPhoto: async () => null });
    t.ctl.start(); // sin feed: lastCorners null → sin prior
    expect(await t.ctl.captureManual()).toBe('captured');
    expect(t.warps).toHaveLength(0);
    const photo = t.events.captured[0] as CapturedF3c;
    expect(photo.quad).toBeNull();
    expect(photo.warped).toBeNull();
  });
});

describe('F3-b: quad refinado en la captura', () => {
  const REFINED = new Float32Array([0.21, 0.26, 0.79, 0.26, 0.79, 0.74, 0.21, 0.74]);

  type CapturedF3b = {
    quadRefined: Array<{ x: number; y: number }> | null;
    needsEditorReview: boolean;
    warped: unknown;
  };

  function setupF3b(
    warpOut: {
      refinedQuad: Float32Array | null;
      refined: boolean;
      fellBack: [boolean, boolean, boolean, boolean] | null;
    },
  ) {
    const photoBmp = fakeBitmap();
    const t = setup({
      capturePhoto: async () => ({ bitmap: photoBmp, w: 3000, h: 4000, route: 'A' }),
      downscale: async () => docSharp(),
      photoProcessBitmap: async () => fakeBitmap(),
      detectPhoto: async () => new Float32Array([0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75]),
      requestWarp: (async () => ({
        bitmap: fakeBitmap(),
        w: 1800,
        h: 2000,
        ...warpOut,
      })) as OrchestratorDeps['requestWarp'],
    });
    return t;
  }

  async function trigger(t: { ctl: ScanOrchestrator; feed: (ts: number) => void }): Promise<void> {
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
  }

  it('refine 4/4 → quadRefined en px de foto, sin marcar revisión', async () => {
    const t = setupF3b({ refinedQuad: REFINED, refined: true, fellBack: [false, false, false, false] });
    await trigger(t);
    const photo = t.events.captured[0] as CapturedF3b;
    expect(photo.warped).not.toBeNull();
    expect(photo.quadRefined).not.toBeNull();
    expect(photo.quadRefined!).toHaveLength(4);
    // REFINED × foto 3000×4000
    expect(photo.quadRefined![0]!.x).toBeCloseTo(630, 3);
    expect(photo.quadRefined![0]!.y).toBeCloseTo(1040, 3);
    expect(photo.needsEditorReview).toBe(false);
  });

  it('lado caído en el refine → needsEditorReview=true (blindaje 3)', async () => {
    const t = setupF3b({ refinedQuad: REFINED, refined: true, fellBack: [false, false, true, false] });
    await trigger(t);
    const photo = t.events.captured[0] as CapturedF3b;
    expect(photo.quadRefined).not.toBeNull();
    expect(photo.needsEditorReview).toBe(true);
  });

  it('warp sin refine (null) → quadRefined null, revisión intacta', async () => {
    const t = setupF3b({ refinedQuad: null, refined: false, fellBack: null });
    await trigger(t);
    const photo = t.events.captured[0] as CapturedF3b;
    expect(photo.quadRefined).toBeNull();
    expect(photo.needsEditorReview).toBe(false);
  });
});

describe('cornerRefiner puro (ensamblado F3-b)', () => {
  it('assemble válido: fracciones → px de foto + flags passthrough', () => {
    const asm = assembleRefinedQuad(
      {
        refinedQuad: new Float32Array([0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75]),
        refined: true,
        fellBack: [false, false, false, false],
      },
      3000,
      4000,
    );
    expect(asm.refined).toBe(true);
    expect(asm.fellBack).toEqual([false, false, false, false]);
    // Fracciones en Float32: tolerancia (0.2 → 600.0000089, no exacto).
    expect(asm.quad![0]!.x).toBeCloseTo(600, 3);
    expect(asm.quad![0]!.y).toBeCloseTo(1000, 3);
    expect(asm.quad![2]!.x).toBeCloseTo(2400, 3);
    expect(asm.quad![2]!.y).toBeCloseTo(3000, 3);
  });
  it('assemble inválido (null / 7 floats / NaN / dims 0) → quad null sin lanzar', () => {
    const bad7 = new Float32Array([0, 0, 1, 0, 1, 1, 0]);
    expect(assembleRefinedQuad({ refinedQuad: null, refined: false, fellBack: null }, 3000, 4000).quad).toBeNull();
    expect(assembleRefinedQuad({ refinedQuad: bad7, refined: true, fellBack: null }, 3000, 4000).quad).toBeNull();
    const nan = new Float32Array([NaN, 0, 1, 0, 1, 1, 0, 1]);
    expect(assembleRefinedQuad({ refinedQuad: nan, refined: true, fellBack: null }, 3000, 4000).quad).toBeNull();
    const ok = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
    expect(assembleRefinedQuad({ refinedQuad: ok, refined: true, fellBack: null }, 0, 4000).quad).toBeNull();
  });
  it('needsEditorReview: null o algún true → true; 4/4 false → false', () => {
    expect(needsEditorReview(null)).toBe(true);
    expect(needsEditorReview([false, false, true, false])).toBe(true);
    expect(needsEditorReview([true, true, true, true])).toBe(true);
    expect(needsEditorReview([false, false, false, false])).toBe(false);
  });
});

describe('F4: edición de esquinas (FSM editing)', () => {
  const PHOTO_QUAD = new Float32Array([0.2, 0.25, 0.8, 0.25, 0.8, 0.75, 0.2, 0.75]);
  const REFINED = new Float32Array([0.21, 0.26, 0.79, 0.26, 0.79, 0.74, 0.21, 0.74]);
  // Quad del humano: TL=(600,1200) … BR=(2400,3000) en px de foto 3000×4000
  // → fracciones [0.2,0.3, 0.8,0.3, 0.8,0.75, 0.2,0.75] y área 3.24M >
  // 0.25·frame = 3M (validateQuad exige ≥25% del frame).
  const ADJUSTED: Quadrilateral = [
    { x: 600, y: 1200 },
    { x: 2400, y: 1200 },
    { x: 2400, y: 3000 },
    { x: 600, y: 3000 },
  ];
  const TINY: Quadrilateral = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  type PhotoF4 = {
    quad: Array<{ x: number; y: number }> | null;
    quadRefined: Array<{ x: number; y: number }> | null;
    adjustedQuad?: Array<{ x: number; y: number }>;
    warped: (ImageBitmap & { closed: boolean }) | null;
    needsEditorReview: boolean;
  };

  function setupF4(over: Partial<OrchestratorDeps> = {}) {
    let now = 0;
    const warps: WarpRequest[] = [];
    const events = {
      states: [] as string[],
      captured: [] as unknown[],
      edited: [] as unknown[],
      retries: [] as string[],
      timeouts: 0,
    };
    const deps: OrchestratorDeps = {
      now: () => now,
      sampleExposure: () => ({ hist: [...GOOD_HIST] }),
      captureBurstFrames: async () => [
        { bitmap: fakeBitmap(), w: 640, h: 480, route: 'B' },
        { bitmap: fakeBitmap(), w: 640, h: 480, route: 'B' },
      ],
      capturePhoto: async () => ({ bitmap: fakeBitmap(), w: 3000, h: 4000, route: 'A' }),
      downscale: async () => docSharp(),
      photoProcessBitmap: async () => fakeBitmap(),
      detectPhoto: async () => PHOTO_QUAD,
      requestWarp: (async (req: WarpRequest) => {
        warps.push(req);
        return {
          bitmap: fakeBitmap(),
          w: 1800,
          h: 2000,
          refinedQuad: REFINED,
          refined: true,
          fellBack: [false, false, false, false],
        };
      }) as OrchestratorDeps['requestWarp'],
      notify: () => 'haptic',
      ...over,
    };
    const ctl = new ScanOrchestrator({
      deps,
      events: {
        onState: (s) => events.states.push(s),
        onScore: () => {},
        onCaptured: (p) => events.captured.push(p),
        onRetry: (r) => events.retries.push(r),
        onTimeout: () => events.timeouts++,
        onEdited: (p) => events.edited.push(p),
      },
      cooldownMs: 30,
    });
    const q: RawQualityInput = {
      laplacianVar: 500,
      cropMean: 128,
      cropStdDev: 20,
      frameW: 640,
      frameH: 480,
    };
    return {
      ctl,
      events,
      warps,
      setNow: (t: number) => {
        now = t;
      },
      feed: (ts: number, corners: Float32Array | null = CENTERED) => {
        now = ts;
        ctl.onWorkerResult(q, corners, ts);
      },
    };
  }

  async function capture(t: {
    ctl: ScanOrchestrator;
    feed: (ts: number, corners?: Float32Array | null) => void;
  }): Promise<void> {
    t.ctl.start();
    for (const ts of [0, 100, 200, 400, 600, 700]) t.feed(ts);
    await new Promise((r) => setTimeout(r, 0));
  }

  /** Compara fracciones (Float32Array) con números con tolerancia. */
  function expectQuadClose(actual: Float32Array, expected: number[]): void {
    expect(Array.from(actual)).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expect(actual[i]!).toBeCloseTo(expected[i]!, 3);
    }
  }

  it('captura → openEditor true (solo desde captured); cooldown SUSPENDIDO en editing', async () => {
    const t = setupF4();
    await capture(t);
    expect(t.ctl.getState()).toBe('captured');
    expect(t.ctl.openEditor()).toBe(true);
    expect(t.ctl.getState()).toBe('editing');
    expect(t.events.states).toContain('editing');
    t.setNow(5000); // muy por encima del cooldown 30ms…
    await new Promise((r) => setTimeout(r, 40));
    expect(t.ctl.getState()).toBe('editing'); // …pero nadie expulsa: timer suspendido
  });

  it('openEditor desde detecting → false (sin captura actual)', () => {
    const t = setupF4();
    t.ctl.start();
    expect(t.ctl.getState()).toBe('detecting');
    expect(t.ctl.openEditor()).toBe(false);
  });

  it('submitEditedQuad: re-warp con el ajustado, onEdited, auto intacto, cooldown normal', async () => {
    const t = setupF4();
    await capture(t);
    expect(t.warps).toHaveLength(1); // warp de la captura (con PHOTO_QUAD)
    expect(t.ctl.openEditor()).toBe(true);
    expect(await t.ctl.submitEditedQuad(ADJUSTED)).toBe('ok');
    // 2º warp = el ajuste en fracciones (TL,TR,BR,BL del humano)
    expect(t.warps).toHaveLength(2);
    expectQuadClose(t.warps[1]!.quad, [0.2, 0.3, 0.8, 0.3, 0.8, 0.75, 0.2, 0.75]);
    // onEdited: captura corregida (ajustado + warped nuevo), auto conservado
    expect(t.events.edited).toHaveLength(1);
    const photo = t.events.edited[0] as PhotoF4;
    expect(photo.adjustedQuad).toEqual(ADJUSTED);
    expect(photo.warped).not.toBeNull();
    expect(photo.needsEditorReview).toBe(false);
    expect(photo.quadRefined).not.toBeNull(); // el auto NO se toca (anti-sesgo)
    expect(photo.quadRefined![0]!.x).toBeCloseTo(630, 3); // REFINED × 3000×4000
    // Estado: 'captured' (no existe 'saved') → cooldown normal → detecting
    expect(t.ctl.getState()).toBe('captured');
    await new Promise((r) => setTimeout(r, 40));
    expect(t.ctl.getState()).toBe('detecting');
  });

  it('submitEditedQuad inválido (área < 25% frame) → invalid, sigue editing, sin warp', async () => {
    const t = setupF4();
    await capture(t);
    t.ctl.openEditor();
    expect(await t.ctl.submitEditedQuad(TINY)).toBe('invalid');
    expect(t.ctl.getState()).toBe('editing');
    expect(t.warps).toHaveLength(1); // sin re-warp
    expect(t.events.edited).toHaveLength(0);
  });

  it('revertEditedQuad: re-warp con el AUTO (refinado), descarta el ajuste, sigue editing', async () => {
    const t = setupF4();
    await capture(t);
    t.ctl.openEditor();
    // (a) revert en frío: sin ajuste previo, re-warp con el quad del auto
    expect(await t.ctl.revertEditedQuad()).toBe(true);
    expect(t.ctl.getState()).toBe('editing'); // el editor NO se cierra
    expectQuadClose(t.warps[1]!.quad, Array.from(REFINED));
    expect((t.events.edited[0] as PhotoF4).adjustedQuad).toBeUndefined();
    // (b) con ajuste confirmado: submit → cierra el editor → reabrir → revert
    expect(await t.ctl.submitEditedQuad(ADJUSTED)).toBe('ok');
    expect(t.ctl.getState()).toBe('captured'); // submit cierra el editor
    expect(t.ctl.openEditor()).toBe(true);
    expect(await t.ctl.revertEditedQuad()).toBe(true);
    expect(t.warps).toHaveLength(4); // captura + revert-frío + submit + revert-2
    expectQuadClose(t.warps[3]!.quad, Array.from(REFINED));
    expect(t.events.edited).toHaveLength(3);
    const photo = t.events.edited[2] as PhotoF4;
    expect(photo.adjustedQuad).toBeUndefined(); // descartado al revertir
    expect(photo.quadRefined![0]!.x).toBeCloseTo(630, 3); // evidencia auto intacta
    expect(t.ctl.getState()).toBe('editing');
  });

  it('revert sin quad automático (captura sin detección) → false, sin warp ni evento', async () => {
    const t = setupF4({ detectPhoto: async () => null });
    t.ctl.start(); // sin feed: ni stream-prior habrá
    expect(await t.ctl.captureManual()).toBe('captured');
    const photo = t.events.captured[0] as PhotoF4;
    expect(photo.quad).toBeNull();
    expect(photo.quadRefined).toBeNull();
    expect(t.ctl.openEditor()).toBe(true);
    expect(await t.ctl.revertEditedQuad()).toBe(false); // nada que re-warpéar
    expect(t.warps).toHaveLength(0);
    expect(t.events.edited).toHaveLength(0);
    expect(t.ctl.getState()).toBe('editing');
  });

  it('cancelEditing: sin re-warp ni evento; cooldown re-armado devuelve a detecting', async () => {
    const t = setupF4();
    await capture(t);
    t.ctl.openEditor();
    expect(t.ctl.cancelEditing()).toBe(true);
    expect(t.ctl.getState()).toBe('captured');
    expect(t.warps).toHaveLength(1);
    expect(t.events.edited).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 40));
    expect(t.ctl.getState()).toBe('detecting');
  });

  it('captureManual + todos los métodos de edición fuera de editing → busy/false', async () => {
    const t = setupF4();
    await capture(t);
    expect(t.ctl.getState()).toBe('captured');
    expect(await t.ctl.captureManual()).toBe('busy');
    expect(await t.ctl.submitEditedQuad(ADJUSTED)).toBe('busy');
    expect(await t.ctl.revertEditedQuad()).toBe(false);
    expect(t.ctl.cancelEditing()).toBe(false);
    expect(t.events.edited).toHaveLength(0);
    expect(t.warps).toHaveLength(1);
    // en editing, el botón de captura NO dispara
    t.ctl.openEditor();
    expect(await t.ctl.captureManual()).toBe('busy');
  });
});



describe('F6.4: extendDeadline (segundo plano)', () => {
  it('CONTROL sin extend: >8s desde start → onTimeout (comportamiento histórico)', () => {
    const t = setup();
    t.ctl.start(); // firstAttempt = 0
    t.feed(8500, null);
    expect(t.events.timeouts).toBe(1);
  });
  it('con extendDeadline el tiempo oculto NO cuenta como falta de detección', () => {
    const t = setup();
    t.ctl.start(); // firstAttempt = 0
    t.setNow(7000);
    t.ctl.extendDeadline(); // re-arma: firstAttempt = 7000 (vuelta de background)
    t.feed(7500, null); // 500ms desde el re-arme
    expect(t.events.timeouts).toBe(0);
    expect(t.ctl.getState()).toBe('detecting');
  });
  it('no-op fuera de detecting: idle no se reactiva ni dispara timeout', () => {
    const t = setup();
    t.ctl.stop();
    t.setNow(99000);
    t.ctl.extendDeadline();
    t.feed(100000, null);
    expect(t.ctl.getState()).toBe('idle');
    expect(t.events.timeouts).toBe(0);
  });
});
