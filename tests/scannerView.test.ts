// tests/scannerView.test.ts — matemática del overlay + render con mocks (F1).
// displayRect/nativo↔display portados del spike (drag 0px error allí);
// D2 portrait; render verde/rojo/hint con contexto 2d falso.
import { describe, expect, it, vi } from 'vitest';

import {
  OVERLAY_BAD,
  OVERLAY_OK,
  PORTRAIT_HINT,
  ScannerView,
  disp2native,
  displayRect,
  native2disp,
  shouldSuggestPortrait,
} from '../src/ui/ScannerView';

describe('displayRect (object-fit: contain)', () => {
  it('canvas más ancho que el video → bandas laterales', () => {
    const r = displayRect(800, 400, 640, 480);
    expect(r.y).toBe(0);
    expect(r.h).toBe(400);
    expect(r.w).toBeCloseTo((400 * 4) / 3, 9);
    expect(r.x).toBeCloseTo((800 - (400 * 4) / 3) / 2, 9);
  });
  it('canvas más alto → bandas arriba/abajo', () => {
    const r = displayRect(400, 800, 640, 480);
    expect(r.x).toBe(0);
    expect(r.w).toBe(400);
    expect(r.h).toBeCloseTo(300, 10);
    expect(r.y).toBeCloseTo(250, 10);
  });
  it('mismo aspecto → fullscreen', () => {
    expect(displayRect(640, 480, 640, 480)).toEqual({ x: 0, y: 0, w: 640, h: 480 });
  });
  it('dims inválidas → rect fallback sin romper', () => {
    expect(displayRect(100, 100, 0, 0)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
});

describe('nativo ↔ display (roundtrip)', () => {
  it('ida y vuelta exactas', () => {
    const r = displayRect(800, 600, 640, 480);
    const d = native2disp(320, 240, r, 640, 480);
    const n = disp2native(d.x, d.y, r, 640, 480);
    expect(n.x).toBeCloseTo(320, 9);
    expect(n.y).toBeCloseTo(240, 9);
  });
});

describe('shouldSuggestPortrait (D2)', () => {
  // frame landscape 640×480; quad portrait centrado (fracciones)
  const PORTRAIT = new Float32Array([0.35, 0.1, 0.65, 0.1, 0.65, 0.9, 0.35, 0.9]);
  const LANDSCAPE_Q = new Float32Array([0.1, 0.3, 0.9, 0.3, 0.9, 0.7, 0.1, 0.7]);
  it('quad alto + frame landscape → true', () => {
    expect(shouldSuggestPortrait(PORTRAIT, 640, 480)).toBe(true);
  });
  it('quad ancho → false; frame portrait → false', () => {
    expect(shouldSuggestPortrait(LANDSCAPE_Q, 640, 480)).toBe(false);
    expect(shouldSuggestPortrait(PORTRAIT, 480, 640)).toBe(false);
  });
  it('8 valores requeridos; NaN → false', () => {
    expect(shouldSuggestPortrait(new Float32Array(6), 640, 480)).toBe(false);
    const bad = new Float32Array([NaN, 0, 1, 0, 1, 1, 0, 1]);
    expect(shouldSuggestPortrait(bad, 640, 480)).toBe(false);
  });
  it('texto del aviso fijado', () => {
    expect(PORTRAIT_HINT).toBe('Gira el teléfono en vertical');
  });
});

function mockCtx() {
  return {
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: '',
    lineWidth: 0,
    fillStyle: '',
    font: '',
  };
}

function mockView(ctx: ReturnType<typeof mockCtx>) {
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
  const canvas = {
    clientWidth: 640,
    clientHeight: 480,
    width: 640,
    height: 480,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  return new ScannerView(video, canvas);
}

describe('ScannerView.render', () => {
  it('quad válido → polígono verde cerrado', () => {
    const ctx = mockCtx();
    mockView(ctx).render(
      { corners: new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]), valid: true },
      640,
      480,
    );
    expect(ctx.strokeStyle).toBe(OVERLAY_OK);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(3);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(1);
  });
  it('sin quad → marco rojo', () => {
    const ctx = mockCtx();
    mockView(ctx).render({ corners: null, valid: false }, 640, 480);
    expect(ctx.strokeStyle).toBe(OVERLAY_BAD);
    expect(ctx.strokeRect).toHaveBeenCalledTimes(1);
  });
  it('hint D2 → fillText verde', () => {
    const ctx = mockCtx();
    mockView(ctx).render({ corners: null, valid: false }, 640, 480, PORTRAIT_HINT);
    expect(ctx.fillText).toHaveBeenCalledWith(PORTRAIT_HINT, 12, 24);
  });
  it('sin contexto → no rompe', () => {
    const video = {} as HTMLVideoElement;
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() =>
      new ScannerView(video, canvas).render({ corners: null, valid: false }, 1, 1),
    ).not.toThrow();
  });
});
