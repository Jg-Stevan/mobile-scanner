// tests/lifecycle.test.ts — F6.4: visibilidad (background) y salud del track.
// Deps inyectadas (documento falso) — el default real usa document.
import { describe, expect, it, vi } from 'vitest';

import { attachLifecycle, trackIsLive } from '../src/camera/lifecycle';

/** Documento mínimo con listeners de visibilitychange despachables. */
function fakeDoc() {
  const cbs = new Set<() => void>();
  return {
    hidden: false,
    addListener: (_t: 'visibilitychange', cb: () => void) => cbs.add(cb),
    removeListener: (_t: 'visibilitychange', cb: () => void) => cbs.delete(cb),
    fire(): void {
      for (const cb of [...cbs]) cb();
    },
  };
}

describe('attachLifecycle', () => {
  it('hidden → onHidden; visible → onVisible (lee isHidden EN el evento)', () => {
    const doc = fakeDoc();
    const hooks = { onHidden: vi.fn(), onVisible: vi.fn() };
    attachLifecycle(hooks, {
      addListener: doc.addListener,
      removeListener: doc.removeListener,
      isHidden: () => doc.hidden,
    });
    doc.hidden = true;
    doc.fire();
    expect(hooks.onHidden).toHaveBeenCalledTimes(1);
    expect(hooks.onVisible).not.toHaveBeenCalled();
    doc.hidden = false;
    doc.fire();
    expect(hooks.onVisible).toHaveBeenCalledTimes(1);
    expect(hooks.onHidden).toHaveBeenCalledTimes(1);
  });
  it('detach: ya no emite (y es idempotente)', () => {
    const doc = fakeDoc();
    const hooks = { onHidden: vi.fn(), onVisible: vi.fn() };
    const detach = attachLifecycle(hooks, {
      addListener: doc.addListener,
      removeListener: doc.removeListener,
      isHidden: () => false,
    });
    detach();
    detach();
    doc.fire();
    expect(hooks.onVisible).not.toHaveBeenCalled();
    expect(hooks.onHidden).not.toHaveBeenCalled();
  });
  it('múltiples ciclos oculto/visible disparan en orden', () => {
    const doc = fakeDoc();
    const order: string[] = [];
    attachLifecycle(
      {
        onHidden: () => order.push('h'),
        onVisible: () => order.push('v'),
      },
      {
        addListener: doc.addListener,
        removeListener: doc.removeListener,
        isHidden: () => doc.hidden,
      },
    );
    for (let i = 0; i < 3; i++) {
      doc.hidden = true;
      doc.fire();
      doc.hidden = false;
      doc.fire();
    }
    expect(order).toEqual(['h', 'v', 'h', 'v', 'h', 'v']);
  });
});

describe('trackIsLive', () => {
  it('readyState live → true; ended → false', () => {
    expect(trackIsLive({ readyState: 'live' })).toBe(true);
    expect(trackIsLive({ readyState: 'ended' })).toBe(false);
  });
  it('null/undefined → true (sin track no hay nada que perder)', () => {
    expect(trackIsLive(null)).toBe(true);
    expect(trackIsLive(undefined)).toBe(true);
  });
  it('solo mira readyState: muted NO invalida (transitorio de iOS)', () => {
    expect(trackIsLive({ readyState: 'live', muted: true } as MediaStreamTrack)).toBe(true);
  });
});
