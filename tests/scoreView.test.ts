// tests/scoreView.test.ts — anillo + aviso (F2).
import { describe, expect, it, vi } from 'vitest';

import { RING_BAD, RING_OK, RING_WARN, ScoreView, ringAngles, ringColor } from '../src/ui/ScoreView';

describe('ringColor/ringAngles (puros)', () => {
  it('verde ≥0.8, amarillo ≥0.5, rojo debajo', () => {
    expect(ringColor(0.9)).toBe(RING_OK);
    expect(ringColor(0.8)).toBe(RING_OK);
    expect(ringColor(0.6)).toBe(RING_WARN);
    expect(ringColor(0.3)).toBe(RING_BAD);
  });
  it('arco proporcional desde arriba, con clamp', () => {
    const full = ringAngles(1);
    expect(full.end - full.start).toBeCloseTo(Math.PI * 2, 10);
    expect(ringAngles(0).end).toBe(ringAngles(0).start);
    expect(ringAngles(2).end - ringAngles(2).start).toBeCloseTo(Math.PI * 2, 10);
    expect(ringAngles(-1).end).toBe(ringAngles(-1).start);
  });
});

describe('ScoreView.render', () => {
  function mockCtx() {
    return {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeStyle: '',
      lineWidth: 0,
      fillStyle: '',
      font: '',
      textAlign: '',
    };
  }
  it('dibuja base + arco + % + hint', () => {
    const ctx = mockCtx();
    const canvas = {
      width: 120,
      height: 120,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    new ScoreView(canvas).render(0.85, 'Centra el documento');
    expect(ctx.arc).toHaveBeenCalledTimes(2); // base + progreso
    expect(ctx.strokeStyle).toBe(RING_OK);
    expect(ctx.fillText).toHaveBeenCalledWith('85', 60, 67);
    expect(ctx.fillText).toHaveBeenCalledWith('Centra el documento', 60, 110);
  });
  it('sin hint → solo %', () => {
    const ctx = mockCtx();
    const canvas = {
      width: 120,
      height: 120,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    new ScoreView(canvas).render(0.2, null);
    expect(ctx.fillText).toHaveBeenCalledTimes(1);
    expect(ctx.strokeStyle).toBe(RING_BAD);
    expect(RING_WARN).toBe('#eab308');
  });
  it('sin contexto → no rompe', () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;
    expect(() => new ScoreView(canvas).render(1, null)).not.toThrow();
  });
});
