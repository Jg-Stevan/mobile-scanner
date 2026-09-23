// tests/warp.test.ts — dims de salida del warp (F3-c · PLAN_MAESTRO §F3) +
// roundtrip del protocolo WarpRequest/WarpResult. Puro Node, sin DOM ni WASM.
import { describe, expect, it } from 'vitest';

import type { Quadrilateral } from '../src/core/types';
import {
  UNSHARP_AMOUNT,
  UNSHARP_KERNEL_SIZE,
  UNSHARP_RADIUS,
  WARP_MAX_LONG_SIDE,
  computeWarpDims,
} from '../src/core/warp';
import type {
  WarpRequest,
  WarpResult,
  WorkerIn,
  WorkerOut,
} from '../src/workers/protocol';

function quad(w: number, h: number): Quadrilateral {
  // Rectángulo axis-aligned w×h: lados opuestos iguales y exactos.
  return [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
}

describe('constantes F3-c (origen §F3, NO recalcular)', () => {
  it('WARP_MAX_LONG_SIDE = 3500 (cap VALIDADO ~318 DPI en carta)', () => {
    expect(WARP_MAX_LONG_SIDE).toBe(3500);
  });
  it('unsharp 0.5/1.5 + kernel impar ≥3 derivado del radio', () => {
    expect(UNSHARP_AMOUNT).toBe(0.5);
    expect(UNSHARP_RADIUS).toBe(1.5);
    expect(UNSHARP_KERNEL_SIZE % 2).toBe(1);
    expect(UNSHARP_KERNEL_SIZE).toBeGreaterThanOrEqual(3);
  });
});

describe('computeWarpDims — el aspecto sale DEL QUAD, nunca de ratios literales', () => {
  it('quad apaisado 800×600 → 800×600 (sin cap, sin tocar)', () => {
    expect(computeWarpDims(quad(800, 600))).toEqual({ w: 800, h: 600 });
  });
  it('quad vertical 600×800 → 600×800 (orientación del quad manda)', () => {
    expect(computeWarpDims(quad(600, 800))).toEqual({ w: 600, h: 800 });
  });
  it('lados opuestos desiguales → manda el MAYOR por eje', () => {
    // Trapezoide: top=100, bottom=120, laterales √(10²+50²)≈50.99 → h=51.
    const trap: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 110, y: 50 },
      { x: -10, y: 50 },
    ];
    expect(computeWarpDims(trap)).toEqual({ w: 120, h: 51 });
  });
  it('lado largo > 3500 → cap exacto con escala UNIFORME', () => {
    const d = computeWarpDims(quad(6000, 4000));
    expect(d.w).toBe(3500);
    expect(d.h).toBe(Math.round(4000 * (3500 / 6000))); // 2333: proporción intacta
  });
  it('lado largo vertical > 3500 → cap por el alto', () => {
    const d = computeWarpDims(quad(4000, 6000));
    expect(d.h).toBe(3500);
    expect(d.w).toBe(Math.round(4000 * (3500 / 6000)));
  });
  it('lado largo == 3500 → intacto (el cap solo reduce)', () => {
    expect(computeWarpDims(quad(3500, 2000))).toEqual({ w: 3500, h: 2000 });
  });
  it('quad degenerado (área cero) → ≥1×1 sin lanzar', () => {
    const d = computeWarpDims(quad(0, 0));
    expect(d.w).toBeGreaterThanOrEqual(1);
    expect(d.h).toBeGreaterThanOrEqual(1);
  });
  it('quad no-finito → 1×1 sin lanzar (el worker no debe morir)', () => {
    const bad: Quadrilateral = [
      { x: NaN, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    expect(computeWarpDims(bad)).toEqual({ w: 1, h: 1 });
  });
});

describe('protocolo warp (patrón DetectRequest/ResultReply)', () => {
  it('WarpRequest entra por WorkerIn y WarpResult sale por WorkerOut (eco de ts)', () => {
    const fake = { width: 10, height: 10, close: () => {} } as unknown as ImageBitmap;
    const req: WorkerIn = {
      type: 'warp',
      bitmap: fake,
      quad: new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]),
      ts: 4242,
    } satisfies WarpRequest;
    const res: WorkerOut = {
      type: 'warped',
      bitmap: fake,
      w: 800,
      h: 600,
      ts: (req as WarpRequest).ts,
      refinedQuad: new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]),
      refined: true,
      fellBack: [false, false, false, false],
    } satisfies WarpResult;
    expect(req.type).toBe('warp');
    expect(res.type).toBe('warped');
    expect((res as WarpResult).ts).toBe(4242);
    expect((res as WarpResult).w).toBe(800);
  });
});
