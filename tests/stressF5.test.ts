import { afterAll, describe, expect, it } from 'vitest';
import { applyMode } from '../src/workers/pipeline';
import type { CvApi } from '../src/workers/pipeline';

interface F5StressResult {
  durationMs: number;
  iterations: number;
  errors: number;
  checksum: number;
  heapStart: number;
  heapEnd: number;
  heapGrowth: number;
  samples: Array<{ minute: number; heapBytes: number }>;
}

declare global {
  var __f5StressResult: F5StressResult | undefined;
}

const nodeProcess = (globalThis as unknown as {
  process: {
    env: Record<string, string | undefined>;
    memoryUsage(): { heapUsed: number };
  };
}).process;
const nodeGc = (globalThis as unknown as { gc?: () => void }).gc;
const enabled = nodeProcess.env['F5_STRESS'] === '1';

describe.skipIf(!enabled)('F5 Node stress', () => {
  afterAll(() => {
    console.log(JSON.stringify(globalThis.__f5StressResult ?? null, null, 2));
  });

  it('10 min enhance con contadores cv.Mat', async () => {
    const width = 640;
    const height = 480;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const value = 70 + ((x * 13 + y * 7) % 150);
        pixels[i] = value;
        pixels[i + 1] = value;
        pixels[i + 2] = value;
        pixels[i + 3] = 255;
      }
    }
    const cv = new Proxy(
      {},
      {
        get(_target, key) {
          throw new Error(`applyMode accedió a cv.${String(key)}`);
        },
      },
    ) as CvApi;
    const modes = ['color', 'gray', 'bw', 'natural'] as const;
    const start = Date.now();
    let iterations = 0;
    let errors = 0;
    let checksum = 0;
    let heapStart = 0;
    let heapEnd = 0;
    const samples: Array<{ minute: number; heapBytes: number }> = [];
    nodeGc?.();
    heapStart = nodeProcess.memoryUsage().heapUsed;
    while (Date.now() - start < 600_000) {
      try {
        const result = applyMode(cv, pixels, modes[iterations % modes.length]!, width, height);
        checksum = (checksum + result.data[123]!) >>> 0;
      } catch {
        errors++;
      }
      iterations++;
      const elapsed = Date.now() - start;
      if (elapsed >= samples.length * 60_000) {
        nodeGc?.();
        samples.push({ minute: Math.floor(elapsed / 60_000), heapBytes: nodeProcess.memoryUsage().heapUsed });
      }
    }
    nodeGc?.();
    heapEnd = nodeProcess.memoryUsage().heapUsed;
    globalThis.__f5StressResult = {
      durationMs: Date.now() - start,
      iterations,
      errors,
      checksum,
      heapStart,
      heapEnd,
      heapGrowth: heapEnd - heapStart,
      samples,
    };
    expect(errors).toBe(0);
    expect(iterations).toBeGreaterThan(0);
    expect(heapEnd - heapStart).toBeLessThan(50 * 1024 * 1024);
  }, 620_000);
});
