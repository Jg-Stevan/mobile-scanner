// tests/scanOrchestrator.test.ts — FSM + burst-rank + manual + cooldown (F2).
// Deps totalmente inyectadas (reloj manual, bitmaps falsos, downscale en cola).
import { describe, expect, it, vi } from 'vitest';

import type { OrchestratorDeps } from '../src/scan/ScanOrchestrator';
import { CAPTURE_COOLDOWN_MS, ScanOrchestrator } from '../src/scan/ScanOrchestrator';
import type { DetectRequest, RawQualityInput } from '../src/workers/protocol';

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


