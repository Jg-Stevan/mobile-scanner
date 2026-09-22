// tests/frameLoop.test.ts — backpressure del lado UI con mocks totales.
// Determinista: scheduler manual, capture inmediata, worker falso.
// Verifica: envío solo si libre, descarte con conteo, bitmap como transferable,
// 'result' libera, 'busy' no libera, fallo de captura libera, stop termina.
import { describe, expect, it, vi } from 'vitest';

import type { FrameLoopDeps } from '../src/camera/frameLoop';
import { startFrameLoop } from '../src/camera/frameLoop';
import type { RawQualityInput, WorkerOut } from '../src/workers/protocol';
import { computeProcessDims } from '../src/workers/protocol';

interface FakeBitmap {
  closed: boolean;
  close(): void;
}

function setup(captureImpl?: () => Promise<FakeBitmap>) {
  const queued: Array<() => void> = [];
  let seq = 0;
  const cancelled: number[] = [];
  const posted: Array<{ msg: { type: string; bitmap: unknown; ts: number }; transfer: unknown[] }> =
    [];
  let terminated = false;
  const results: Array<{ q: RawQualityInput; ts: number }> = [];
  const statuses: WorkerOut[] = [];

  const bitmaps: FakeBitmap[] = [];
  const deps: FrameLoopDeps = {
    requestFrame: (cb) => {
      queued.push(cb);
      seq += 1;
      return seq;
    },
    cancelFrame: (h) => {
      cancelled.push(h);
    },
    capture: async () => {
      if (captureImpl !== undefined) return captureImpl() as unknown as ImageBitmap;
      const b: FakeBitmap = { closed: false, close: () => { b.closed = true; } };
      bitmaps.push(b);
      return b as unknown as ImageBitmap;
    },
    now: () => 1000,
  };

  const worker = {
    postMessage: vi.fn((msg: { type: string; bitmap: unknown; ts: number }, transfer: unknown[]) => {
      posted.push({ msg, transfer });
    }),
    terminate: vi.fn(() => {
      terminated = true;
    }),
    onmessage: null as ((ev: MessageEvent) => void) | null,
  } as unknown as Worker;

  const video = {} as HTMLVideoElement;
  const handle = startFrameLoop({
    video,
    worker,
    deps,
    onResult: (q, ts) => results.push({ q, ts }),
    onStatus: (m) => statuses.push(m),
  });

  const fire = async (i: number): Promise<void> => {
    queued[i]!();
    await new Promise((r) => setTimeout(r, 0));
  };
  const deliver = (data: WorkerOut): void => {
    worker.onmessage!({ data } as MessageEvent);
  };
  return { queued, cancelled, posted, results, statuses, bitmaps, worker, handle, fire, deliver,
    isTerminated: () => terminated };
}

const RESULT: WorkerOut = {
  type: 'result',
  corners: null,
  qualityInput: { laplacianVar: 144, cropMean: 128, cropStdDev: 12, frameW: 640, frameH: 480 },
  ts: 1000,
};

describe('frameLoop backpressure', () => {
  it('envía el 1º, descarta el 2º mientras está ocupado, envía el 3º tras result', async () => {
    const t = setup();
    await t.fire(0);
    expect(t.posted).toHaveLength(1);
    expect(t.handle.stats()).toEqual({ sent: 1, dropped: 0, captureErrors: 0 });
    await t.fire(1); // worker aún ocupado → descarte
    expect(t.posted).toHaveLength(1);
    expect(t.handle.stats()).toEqual({ sent: 1, dropped: 1, captureErrors: 0 });
    t.deliver(RESULT);
    await t.fire(2);
    expect(t.posted).toHaveLength(2);
    expect(t.handle.stats()).toEqual({ sent: 2, dropped: 1, captureErrors: 0 });
    expect(t.results).toHaveLength(1);
    expect(t.results[0]!.q.laplacianVar).toBe(144);
  });
  it('el bitmap viaja como transferable', async () => {
    const t = setup();
    await t.fire(0);
    expect(t.posted[0]!.msg.type).toBe('detect');
    expect(t.posted[0]!.transfer).toHaveLength(1);
    expect(t.posted[0]!.transfer[0]).toBe(t.posted[0]!.msg.bitmap);
  });
  it("'busy' NO libera el flag (se sigue esperando el result en vuelo)", async () => {
    const t = setup();
    await t.fire(0);
    t.deliver({ type: 'busy', ts: 1000 });
    await t.fire(1);
    expect(t.posted).toHaveLength(1); // sigue ocupado
    expect(t.handle.stats().dropped).toBe(1);
    t.deliver(RESULT);
    await t.fire(2);
    expect(t.posted).toHaveLength(2);
  });
  it('fallo de captura libera el flag (no se atasca)', async () => {
    let calls = 0;
    const t = setup(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error('video detenido'));
      const b: FakeBitmap = { closed: false, close: () => { b.closed = true; } };
      return Promise.resolve(b);
    });
    await t.fire(0); // captura falla → flag libre
    expect(t.posted).toHaveLength(0);
    await t.fire(1); // se envía sin descarte
    expect(t.posted).toHaveLength(1);
    expect(t.handle.stats()).toEqual({ sent: 1, dropped: 0, captureErrors: 0 });
  });
  it("boot/ready/error van a onStatus, no a onResult", async () => {
    const t = setup();
    t.deliver({ type: 'boot', pct: 5 });
    t.deliver({ type: 'ready' });
    expect(t.statuses).toEqual([{ type: 'boot', pct: 5 }, { type: 'ready' }]);
    expect(t.results).toHaveLength(0);
  });
  it("F1-a: 'error' del worker libera el flag (no hay descarte permanente)", async () => {
    const t = setup();
    await t.fire(0);
    expect(t.posted).toHaveLength(1);
    expect(t.handle.stats()).toEqual({ sent: 1, dropped: 0, captureErrors: 0 });
    // El worker falla el frame en vuelo (p. ej. OOM de cv en móvil)
    t.deliver({ type: 'error', message: 'boom' });
    expect(t.statuses).toEqual([{ type: 'error', message: 'boom' }]);
    await t.fire(1);
    // Sin el fix: posted seguiría en 1 y dropped en 1 (congelado para siempre)
    expect(t.posted).toHaveLength(2);
    expect(t.handle.stats()).toEqual({ sent: 2, dropped: 0, captureErrors: 0 });
    t.deliver(RESULT);
    await t.fire(2);
    expect(t.posted).toHaveLength(3);
  });
  it('captureErrors cuenta racha de fallos y se resetea al enviar', async () => {
    let fail = true;
    const t = setup(() => {
      if (fail) return Promise.reject(new Error('x'));
      const b: FakeBitmap = { closed: false, close: () => { b.closed = true; } };
      return Promise.resolve(b);
    });
    await t.fire(0);
    await t.fire(1);
    expect(t.handle.stats()).toEqual({ sent: 0, dropped: 0, captureErrors: 2 });
    fail = false;
    await t.fire(2);
    expect(t.handle.stats()).toEqual({ sent: 1, dropped: 0, captureErrors: 0 });
  });
  it('stop cancela el loop y termina el worker', async () => {
    const t = setup();
    await t.fire(0);
    t.handle.stop();
    expect(t.cancelled.length).toBeGreaterThan(0);
    expect(t.isTerminated()).toBe(true);
  });
});

describe('computeProcessDims (F1-opt P3: preserve lado mayor 400)', () => {
  it('9:16 portrait → 225×400 (lado mayor 400)', () => {
    expect(computeProcessDims(1080, 1920, 'preserve')).toEqual({ w: 225, h: 400 });
  });
  it('4:3 landscape → 400×300', () => {
    expect(computeProcessDims(640, 480, 'preserve')).toEqual({ w: 400, h: 300 });
  });
  it('squash o dims inválidas → fallback 640×480', () => {
    expect(computeProcessDims(1080, 1920, 'squash')).toEqual({ w: 640, h: 480 });
    expect(computeProcessDims(0, 0, 'preserve')).toEqual({ w: 640, h: 480 });
    expect(computeProcessDims(NaN, 480, 'preserve')).toEqual({ w: 640, h: 480 });
  });
  it('el loop usa preserve con las dims reales del video', async () => {
    const seen: unknown[] = [];
    const video = { videoWidth: 1080, videoHeight: 1920 } as HTMLVideoElement;
    const w = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
    } as unknown as Worker;
    const queued: Array<() => void> = [];
    const handle = startFrameLoop({
      video,
      worker: w,
      deps: {
        requestFrame: (cb) => {
          queued.push(cb);
          return 1;
        },
        cancelFrame: () => {},
        capture: (async (_v: unknown, cw: number, ch: number) => {
          seen.push([cw, ch]);
          return { close: () => {} };
        }) as FrameLoopDeps['capture'],
        now: () => 0,
      },
    });
    queued[0]!();
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([[225, 400]]);
    handle.stop();
  });
});

describe('frameLoop defaults (rVFC/rAF + createImageBitmap reales por globals)', () => {
  function fakeWorker() {
    const posted: unknown[] = [];
    let terminated = false;
    const worker = {
      postMessage: vi.fn((m: unknown) => posted.push(m)),
      terminate: vi.fn(() => {
        terminated = true;
      }),
      onmessage: null as ((ev: MessageEvent) => void) | null,
    } as unknown as Worker;
    return { worker, posted, isTerminated: () => terminated };
  }

  it('usa requestVideoFrameCallback del video cuando existe', async () => {
    const rafCbs: Array<() => void> = [];
    const video = {
      requestVideoFrameCallback: vi.fn((cb: () => void) => {
        rafCbs.push(cb);
        return 7;
      }),
      cancelVideoFrameCallback: vi.fn(),
    } as unknown as HTMLVideoElement;
    const w = fakeWorker();
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const handle = startFrameLoop({ video, worker: w.worker });
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
    rafCbs[0]!();
    await new Promise((r) => setTimeout(r, 0));
    expect(w.posted).toHaveLength(1);
    expect(handle.stats().sent).toBe(1);
    handle.stop();
    expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
    vi.unstubAllGlobals();
  });

  it('fallback a rAF + createImageBitmap con resize a 480p cuando no hay rVFC', async () => {
    const rafCbs: Array<() => void> = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: () => void) => {
        rafCbs.push(cb);
        return 3;
      }),
    );
    const cancelled: number[] = [];
    vi.stubGlobal('cancelAnimationFrame', vi.fn((h: number) => cancelled.push(h)));
    const seenArgs: unknown[] = [];
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async (...args: unknown[]) => {
        seenArgs.push(args);
        return bitmap;
      }),
    );
    const video = {} as HTMLVideoElement;
    const w = fakeWorker();
    const handle = startFrameLoop({ video, worker: w.worker });
    rafCbs[0]!();
    await new Promise((r) => setTimeout(r, 0));
    expect(seenArgs[0]).toEqual([
      video,
      { resizeWidth: 640, resizeHeight: 480, resizeQuality: 'low' },
    ]);
    handle.stop();
    expect(cancelled).toEqual([3]);
    vi.unstubAllGlobals();
  });

  it('si stop llega antes de resolver la captura, el bitmap se cierra sin enviar', async () => {
    let resolveCapture!: (b: ImageBitmap) => void;
    const gate = new Promise<ImageBitmap>((r) => {
      resolveCapture = r;
    });
    const queued: Array<() => void> = [];
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const w = fakeWorker();
    const handle = startFrameLoop({
      video: {} as HTMLVideoElement,
      worker: w.worker,
      deps: {
        requestFrame: (cb) => {
          queued.push(cb);
          return 1;
        },
        cancelFrame: () => {},
        capture: () => gate,
        now: () => 0,
      },
    });
    queued[0]!();
    handle.stop();
    resolveCapture(bitmap);
    await new Promise((r) => setTimeout(r, 0));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(w.posted).toHaveLength(0);
    expect(handle.stats().sent).toBe(0);
  });
});

