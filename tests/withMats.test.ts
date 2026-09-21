// tests/withMats.test.ts — disciplina de memoria WASM (skill opencv-wasm-memoria).
// Con mocks: todo lo trackeado muere en orden LIFO, siempre (feliz/throw/early-return).
import { describe, expect, it } from 'vitest';

import type { MatLike } from '../src/workers/withMats';
import { withMats } from '../src/workers/withMats';

class MockMat implements MatLike {
  deleted = false;
  constructor(readonly name: string, private readonly log: string[]) {}
  delete(): void {
    this.deleted = true;
    this.log.push(this.name);
  }
}

describe('withMats', () => {
  it('destruye en LIFO en la rama feliz y devuelve el valor', () => {
    const log: string[] = [];
    const out = withMats((track) => {
      track(new MockMat('a', log));
      track(new MockMat('b', log));
      track(new MockMat('c', log));
      return 42;
    });
    expect(out).toBe(42);
    expect(log).toEqual(['c', 'b', 'a']);
  });
  it('destruye todo aunque el pipeline lance', () => {
    const log: string[] = [];
    const a = new MockMat('a', log);
    const b = new MockMat('b', log);
    expect(() =>
      withMats((track) => {
        track(a);
        track(b);
        throw new Error('Canny explotó');
      }),
    ).toThrow('Canny explotó');
    expect(a.deleted).toBe(true);
    expect(b.deleted).toBe(true);
    expect(log).toEqual(['b', 'a']);
  });
  it('destruye todo en early-return', () => {
    const log: string[] = [];
    withMats((track) => {
      track(new MockMat('a', log));
      return 'salida temprana';
    });
    expect(log).toEqual(['a']);
  });
});
