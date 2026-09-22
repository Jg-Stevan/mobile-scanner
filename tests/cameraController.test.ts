// tests/cameraController.test.ts — regla D3, fallbacks gUM, torch, profile (T5).
// Todo con MediaDeps inyectados (sin navegador). D3: AF real gana aunque la
// fija sea de mayor resolución; ultra-wide manual (D3 del spike) → descartada.
import { describe, expect, it, vi } from 'vitest';

import type { CameraProbe, MediaDeps } from '../src/camera/CameraController';
import {
  CameraController,
  IDEAL_CAPTURE_WIDTH,
  chooseMainCamera,
  hasRealAutofocus,
} from '../src/camera/CameraController';

const MAIN: CameraProbe = {
  deviceId: 'main-0',
  label: 'Back Camera',
  focusModes: ['continuous', 'manual'],
  torch: true,
  maxWidth: 4000,
  maxHeight: 3000,
};
const ULTRA: CameraProbe = {
  deviceId: 'ultra-2',
  label: 'Ultra-wide Camera',
  focusModes: ['manual'],
  torch: false,
  maxWidth: 8000,
  maxHeight: 6000,
};

function trackStub(settings: Record<string, unknown>, caps: Record<string, unknown>) {
  return {
    label: 'mock-track',
    getSettings: () => settings,
    getCapabilities: () => caps,
    applyConstraints: vi.fn(async () => {}),
    stop: vi.fn(() => {}),
  };
}

function setup(probes: Record<string, CameraProbe>, gumImpl: (c: unknown) => Promise<unknown>) {
  const seen: unknown[] = [];
  let now = 1_000_000;
  const deps: MediaDeps = {
    enumerateDevices: async () =>
      Object.values(probes).map((p) => ({
        deviceId: p.deviceId,
        kind: 'videoinput',
        label: p.label,
        groupId: 'g',
      })) as MediaDeviceInfo[],
    getUserMedia: (async (c: unknown) => {
      seen.push(c);
      return gumImpl(c);
    }) as MediaDeps['getUserMedia'],
    probeDevice: async (id: string) => {
      const p = probes[id];
      if (p === undefined) throw new Error('probe: id desconocido');
      return p;
    },
    now: () => now++,
  };
  return { deps, seen };
}

function streamOf(track: unknown) {
  return { getVideoTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
}

describe('hasRealAutofocus / chooseMainCamera (D3)', () => {
  it('continuous/single-shot = AF real; manual solo = fija', () => {
    expect(hasRealAutofocus(['continuous'])).toBe(true);
    expect(hasRealAutofocus(['single-shot'])).toBe(true);
    expect(hasRealAutofocus(['manual'])).toBe(false);
    expect(hasRealAutofocus([])).toBe(false);
  });
  it('elige la trasera con AF aunque la ultra-wide fija tenga más píxeles', () => {
    const c = chooseMainCamera([ULTRA, MAIN]);
    expect(c!.probe.deviceId).toBe('main-0');
    expect(c!.warnings).toEqual([]);
  });
  it('todas fijas → fallback a la primera + warning', () => {
    const c = chooseMainCamera([{ ...ULTRA, label: 'Back Camera' }]);
    expect(c!.probe.deviceId).toBe('ultra-2');
    expect(c!.warnings.join(' ')).toMatch(/fixed-focus/);
  });
  it('sin etiquetas traseras → evalúa todas + warning (facingMode no pre-stream)', () => {
    const c = chooseMainCamera([{ ...MAIN, label: 'Camera 0' }]);
    expect(c!.probe.deviceId).toBe('main-0');
    expect(c!.warnings.join(' ')).toMatch(/trasera/);
  });
  it('vacío → null', () => {
    expect(chooseMainCamera([])).toBeNull();
  });
});

describe('D6 iOS (F1-b): 8 grupos reales del iPhone 17 Pro, sin focusMode', () => {
  // Labels del spike D5; resoluciones ADVERSAS (la ultra-wide "gana" por píxeles
  // para probar que D6 manda sobre el sort ciego por resolución).
  const IPHONE: CameraProbe[] = [
    { deviceId: 'ff-uw', label: 'Cámara frontal con ultra gran angular', focusModes: [], torch: false, maxWidth: 100, maxHeight: 100 },
    { deviceId: 'triple', label: 'Cámara trasera triple', focusModes: [], torch: true, maxWidth: 200, maxHeight: 200 },
    { deviceId: 'dual-wa', label: 'Cámara trasera dual con gran angular', focusModes: [], torch: true, maxWidth: 300, maxHeight: 300 },
    { deviceId: 'uw', label: 'Cámara trasera con ultra gran angular', focusModes: [], torch: true, maxWidth: 8000, maxHeight: 6000 },
    { deviceId: 'dual', label: 'Cámara trasera dual', focusModes: [], torch: true, maxWidth: 400, maxHeight: 400 },
    { deviceId: 'main', label: 'Cámara trasera', focusModes: [], torch: true, maxWidth: 500, maxHeight: 500 },
    { deviceId: 'ff', label: 'Cámara frontal', focusModes: [], torch: false, maxWidth: 100, maxHeight: 100 },
    { deviceId: 'tele', label: 'Cámara trasera con teleobjetivo', focusModes: [], torch: true, maxWidth: 7000, maxHeight: 5000 },
  ];
  it('elige el grupo simple "Cámara trasera" aunque ultra/tele tengan más píxeles', () => {
    const c = chooseMainCamera(IPHONE);
    expect(c!.probe.deviceId).toBe('main');
    expect(c!.warnings.join(' ')).toMatch(/fixed-focus/);
  });
  it('orden de preferencia: simple-corto > simple-largo > excluidos', () => {
    // Sin "Cámara trasera": gana "dual" (3 palabras) sobre "triple" (3, menos res)
    // y sobre excluidos aunque tengan más píxeles.
    const minusMain = IPHONE.filter((p) => p.deviceId !== 'main');
    const c = chooseMainCamera(minusMain);
    expect(c!.probe.deviceId).toBe('dual');
  });
  it('sin ningún simple → el label más corto + warning explícito', () => {
    const onlyBad = IPHONE.filter((p) => ['uw', 'tele', 'dual-wa'].includes(p.deviceId));
    const c = chooseMainCamera(onlyBad);
    expect(c!.probe.deviceId).toBe('tele'); // "…con teleobjetivo" (31) < dual-wa (37) < uw (38)
    expect(c!.warnings.join(' ')).toMatch(/sin grupo simple/);
  });
  it('Android con AF: D3 manda, D6 no interfiere', () => {
    const c = chooseMainCamera([
      { deviceId: 'uw', label: 'Cámara trasera con ultra gran angular', focusModes: [], torch: false, maxWidth: 8000, maxHeight: 6000 },
      { deviceId: 'm', label: 'Cámara trasera', focusModes: ['continuous'], torch: true, maxWidth: 500, maxHeight: 500 },
    ]);
    expect(c!.probe.deviceId).toBe('m');
    expect(c!.warnings).toEqual([]);
  });
});

describe('CameraController.init', () => {
  it('desbloquea etiquetas con stream genérico antes de enumerar (origen fresco)', async () => {
    const stopped: unknown[] = [];
    const track = trackStub(
      { deviceId: 'main-0', width: 2160, height: 3840 },
      { torch: true, focusMode: ['continuous', 'manual'], zoom: { max: 8 } },
    );
    const { deps, seen } = setup({ 'main-0': MAIN, 'ultra-2': ULTRA }, async () =>
      streamOf(track),
    );
    const unlocking: MediaDeps = {
      ...deps,
      getUserMedia: (async (c: unknown) => {
        seen.push(c);
        if (seen.length === 1) {
          return { getTracks: () => [{ stop: () => stopped.push(1) }] } as unknown as MediaStream;
        }
        return streamOf(track);
      }) as MediaDeps['getUserMedia'],
    };
    const ctl = new CameraController(unlocking);
    await ctl.init();
    expect(seen[0]).toEqual({ video: true });
    expect(stopped).toHaveLength(1);
    expect(seen[1]).toEqual({
      video: { deviceId: { exact: 'main-0' }, width: { ideal: IDEAL_CAPTURE_WIDTH } },
    });
  });
  it('D3 en init: abre la principal (no la ultra-wide) con presupuesto 3840 sin ratio', async () => {
    const track = trackStub(
      { deviceId: 'main-0', width: 2160, height: 3840 },
      { torch: true, focusMode: ['continuous', 'manual'], zoom: { max: 8 } },
    );
    const { deps, seen } = setup({ 'main-0': MAIN, 'ultra-2': ULTRA }, async () =>
      streamOf(track),
    );
    const ctl = new CameraController(deps);
    const profile = await ctl.init();
    expect(seen[0]).toEqual({ video: true }); // desbloqueo de etiquetas
    expect(seen[1]).toEqual({
      video: { deviceId: { exact: 'main-0' }, width: { ideal: IDEAL_CAPTURE_WIDTH } },
    });
    expect(IDEAL_CAPTURE_WIDTH).toBe(3840);
    expect(profile).toMatchObject({
      deviceId: 'main-0',
      label: 'mock-track',
      trackWidth: 2160,
      trackHeight: 3840,
      capabilities: { torch: true, focusModes: ['continuous', 'manual'], zoom: 8 },
    });
    expect(profile.aspectRatio).toBeCloseTo(2160 / 3840, 12);
    expect(ctl.warnings).toEqual([]);
  });
  it('fallback en cascada: sin presupuesto → sin deviceId (warnings)', async () => {
    const track = trackStub({ width: 640, height: 480 }, {});
    let calls = 0;
    const { deps } = setup({ 'main-0': MAIN }, async () => {
      calls++;
      if (calls === 2 || calls === 3) throw new DOMException('over', 'OverconstrainedError');
      return streamOf(track);
    });
    const ctl = new CameraController(deps);
    await ctl.init();
    expect(calls).toBe(4); // 1 unlock + 3 niveles de cascada
    expect(ctl.warnings.join(' ')).toMatch(/fallback nivel 2/);
  });
  it('sin videoinput → throw', async () => {
    const { deps } = setup({}, async () => streamOf(trackStub({}, {})));
    await expect(new CameraController(deps).init()).rejects.toThrow(/sin cámaras/);
  });
});

describe('torch / profile / orientación', () => {
  it('torch presente → applyConstraints advanced; ausente → unsupported silencioso', async () => {
    const withTorch = trackStub({ width: 1, height: 1 }, { torch: true });
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(withTorch));
    const ctl = new CameraController(deps);
    await ctl.init();
    expect(await ctl.setTorch(true)).toBe('on');
    expect(withTorch.applyConstraints).toHaveBeenCalledWith({ advanced: [{ torch: true }] });
    expect(await ctl.setTorch(false)).toBe('off');

    const noTorch = trackStub({ width: 1, height: 1 }, {});
    const d2 = setup({ 'main-0': MAIN }, async () => streamOf(noTorch));
    const ctl2 = new CameraController(d2.deps);
    await ctl2.init();
    expect(await ctl2.setTorch(true)).toBe('unsupported');
    expect(noTorch.applyConstraints).not.toHaveBeenCalled();
  });
  it('refreshProfile re-lee settings (D2 giro) y avanza capturedAt', async () => {
    const holder = { settings: { deviceId: 'm', width: 2160, height: 3840 } };
    const track = {
      label: 'mock-track',
      getSettings: () => holder.settings,
      getCapabilities: () => ({}),
      applyConstraints: vi.fn(async () => {}),
      stop: vi.fn(() => {}),
    };
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(track));
    const ctl = new CameraController(deps);
    const p1 = await ctl.init();
    holder.settings = { deviceId: 'm', width: 3840, height: 2160 };
    const p2 = await ctl.refreshProfile();
    expect(p1.trackWidth).toBe(2160);
    expect(p2.trackWidth).toBe(3840);
    expect(p2.capturedAt).toBeGreaterThan(p1.capturedAt);
  });
  it('watchOrientation re-perfila al girar y el unwatch desprende', async () => {
    const track = trackStub({ width: 1, height: 1 }, {});
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(track));
    const ctl = new CameraController(deps);
    await ctl.init();
    const orientHandlers: Array<() => void> = [];
    const resizeHandlers: Array<() => void> = [];
    vi.stubGlobal('window', {
      screen: {
        orientation: {
          addEventListener: vi.fn((_e: string, h: () => void) => orientHandlers.push(h)),
          removeEventListener: vi.fn(),
        },
      },
      addEventListener: vi.fn((_e: string, h: () => void) => resizeHandlers.push(h)),
      removeEventListener: vi.fn(),
    });
    const seen: number[] = [];
    const unwatch = ctl.watchOrientation((p) => seen.push(p.trackWidth));
    orientHandlers[0]!();
    await new Promise((r) => setTimeout(r, 0));
    resizeHandlers[0]!();
    await new Promise((r) => setTimeout(r, 0));
    expect(seen).toEqual([1, 1]);
    unwatch();
    expect(
      (window.screen.orientation.removeEventListener as ReturnType<typeof vi.fn>).mock.calls,
    ).toHaveLength(1);
    vi.unstubAllGlobals();
  });
  it('stop detiene tracks', async () => {
    const track = trackStub({ width: 1, height: 1 }, {});
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(track));
    const ctl = new CameraController(deps);
    await ctl.init();
    ctl.stop();
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('ramas de error + defaults de navegador', () => {
  it('3 niveles fallan → throw; stream sin track → throw', async () => {
    const d1 = setup({ 'main-0': MAIN }, async () => {
      throw new DOMException('denegado', 'NotAllowedError');
    });
    await expect(new CameraController(d1.deps).init()).rejects.toThrow(/3 niveles/);
    const d2 = setup({ 'main-0': MAIN }, async () => ({ getVideoTracks: () => [] }) as never);
    await expect(new CameraController(d2.deps).init()).rejects.toThrow(/sin video track/);
  });
  it('probe fallido descarta esa cámara con warning y sigue', async () => {
    const { deps } = setup({ 'main-0': MAIN, 'ultra-2': ULTRA }, async () =>
      streamOf(trackStub({ deviceId: 'ultra-2', width: 1, height: 1 }, {})),
    );
    const failing: MediaDeps = {
      ...deps,
      probeDevice: async (id: string) => {
        if (id === 'main-0') throw new Error('permiso');
        return ULTRA;
      },
    };
    const ctl = new CameraController(failing);
    const p = await ctl.init();
    expect(p.deviceId).toBe('ultra-2');
    expect(ctl.warnings.join(' ')).toMatch(/probe falló/);
  });
  it('applyConstraints rechaza → unsupported (degradación silenciosa real)', async () => {
    const track = trackStub({ width: 1, height: 1 }, { torch: true });
    track.applyConstraints = vi.fn(async () => {
      throw new DOMException('no', 'NotAllowedError');
    });
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(track));
    const ctl = new CameraController(deps);
    await ctl.init();
    expect(await ctl.setTorch(true)).toBe('unsupported');
  });
  it('sin init: refreshProfile throw, setTorch unsupported, getProfile null', async () => {
    const { deps } = setup({ 'main-0': MAIN }, async () => streamOf(trackStub({}, {})));
    const ctl = new CameraController(deps);
    expect(ctl.getProfile()).toBeNull();
    await expect(ctl.refreshProfile()).rejects.toThrow(/sin init/);
    expect(await ctl.setTorch(true)).toBe('unsupported');
  });
  it('browser(): probeDevice lee capabilities del track temporal y lo cierra', async () => {
    const probeTrack = trackStub({ deviceId: 'c0', width: 1920, height: 1080 }, {
      focusMode: ['continuous'],
      torch: false,
      width: { max: 1920 },
      height: { max: 1080 },
    });
    const opened: unknown[] = [];
    vi.stubGlobal('navigator', {
      mediaDevices: {
        enumerateDevices: async () => [
          { deviceId: 'c0', kind: 'videoinput', label: 'Back Camera', groupId: 'g' },
        ],
        getUserMedia: async (c: unknown) => {
          opened.push(c);
          return streamOf(probeTrack);
        },
      },
    });
    const ctl = CameraController.browser();
    const p = await ctl.init();
    expect(opened[0]).toEqual({ video: true }); // desbloqueo
    expect(opened[1]).toEqual({ video: { deviceId: { exact: 'c0' } } });
    expect(probeTrack.stop).toHaveBeenCalled();
    expect(p.capabilities.focusModes).toEqual(['continuous']);
    expect(p.deviceId).toBe('c0');
    vi.unstubAllGlobals();
  });
});
