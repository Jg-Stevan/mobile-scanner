// tests/dataCollect.test.ts — registro del dataset F6.5 (orden F4 punto 3).
// Lógica PURO (core/dataCollect.ts): quads en fracciones, serialización
// JSONL, dims del pedestal y presupuesto de cuota. El almacén IndexedDB/DOM
// (datasetStore) y sus tests de integración viven en src/export/.
import { describe, expect, it } from 'vitest';

import {
  CONDITION_TAGS,
  DATASET_TARGET,
  QUOTA_WARN_FRACTION,
  TRAINING_LONG_SIDE,
  autoQuadFractions,
  entryFromCapture,
  entryToJson,
  quadToFractionArray,
  quotaReport,
  toJsonl,
  trainingDims,
  type CaptureSource,
  type DatasetDeviceInfo,
} from '../src/core/dataCollect';
import type { Quadrilateral } from '../src/core/types';

const DEVICE: DatasetDeviceInfo = { platform: 'iPhone', trackW: 1920, trackH: 1080 };

function quad(c: Array<[number, number]>): Quadrilateral {
  return c.map(([x, y]) => ({ x, y })) as Quadrilateral;
}

const PHOTO: CaptureSource = {
  quad: quad([
    [600, 800],
    [2400, 800],
    [2400, 3200],
    [600, 3200],
  ]),
  quadRefined: quad([
    [630, 840],
    [2370, 840],
    [2370, 3160],
    [630, 3160],
  ]),
  frameW: 3000,
  frameH: 4000,
  revalScore: 0.9,
  ts: 123456,
  route: 'A',
};

describe('F4 dataCollect: quads a fracciones', () => {
  it('quadToFractionArray: px → fracciones TL,TR,BR,BL clampadas', () => {
    const f = quadToFractionArray(PHOTO.quad!, 3000, 4000)!;
    expect(Array.from(f)).toHaveLength(8);
    // Float32Array: 0.2 se guarda 0.20000000298023224 → comparar con tolerancia
    for (const [i, exp] of [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8].entries()) {
      expect(f[i]!).toBeCloseTo(exp as number, 4);
    }
  });
  it('quadToFractionArray: esquinas fuera del frame → clamp; NaN o dims 0 → null', () => {
    const over = quad([
      [-100, 5000],
      [3000, 5000],
      [3000, -100],
      [-100, -100],
    ]);
    const f = quadToFractionArray(over, 3000, 4000)!;
    expect(f[0]).toBe(0);
    expect(f[1]).toBe(1);
    expect(f[5]).toBe(0);
    expect(quadToFractionArray(over, 0, 4000)).toBeNull();
    const nan = quad([
      [Number.NaN, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expect(quadToFractionArray(nan, 100, 100)).toBeNull();
  });
  it('autoQuadFractions: cuadRefined gana; sin ambos → null (se registra igual)', () => {
    const f = autoQuadFractions(PHOTO)!;
    expect(f[0]).toBeCloseTo(0.21, 5); // refinado, no la detección 0.2
    expect(f[1]).toBeCloseTo(0.21, 5); // 840/4000
    expect(autoQuadFractions({ quad: null, quadRefined: null, frameW: 3000, frameH: 4000 })).toBeNull();
    expect(
      autoQuadFractions({ quad: null, quadRefined: PHOTO.quadRefined, frameW: 3000, frameH: 4000 }),
    ).not.toBeNull();
  });
});

describe('F4 dataCollect: registro de captura (anti-sesgo)', () => {
  it('entrada completa: autoQuad+felBack+device+condicion; SIN fecha inventada', () => {
    const e = entryFromCapture(PHOTO, DEVICE, 'inclinado', 'cap-1', [false, false, true, false]);
    expect(e.id).toBe('cap-1');
    expect(e.ts).toBe(123456); // timestamp REAL de la captura (no now())
    expect(e.route).toBe('A');
    expect(e.revalScore).toBe(0.9);
    expect(e.autoQuad).not.toBeNull();
    expect(e.autoQuad![0]).toBeCloseTo(0.21, 5);
    expect(e.adjustedQuad).toBeUndefined(); // el humano no editó
    expect(e.fellBack).toEqual([false, false, true, false]);
    expect(e.device).toEqual(DEVICE);
    expect(e.condicion).toBe('inclinado');
  });
  it('ajuste del humano: autoQuad Y adjustedQuad conviven (la evidencia no se mezcla)', () => {
    const withAdj: CaptureSource = {
      ...PHOTO,
      adjustedQuad: quad([
        [900, 1200],
        [2100, 1200],
        [2100, 2800],
        [900, 2800],
      ]),
    };
    const e = entryFromCapture(withAdj, DEVICE, 'normal', 'cap-2');
    expect(e.autoQuad).not.toBeNull(); // el AUTO sigue registrado
    expect(e.adjustedQuad).toEqual(new Float32Array([0.3, 0.3, 0.7, 0.3, 0.7, 0.7, 0.3, 0.7]));
  });
  it('captura sin detección → autoQuad null PERO la entrada existe (no se descarta)', () => {
    const e = entryFromCapture(
      { ...PHOTO, quad: null, quadRefined: null },
      DEVICE,
      'poca-luz',
      'cap-3',
    );
    expect(e.autoQuad).toBeNull();
    expect(e.adjustedQuad).toBeUndefined();
    expect(e.id).toBe('cap-3');
  });
});

describe('F4 dataCollect: serialización JSONL del manifest', () => {
  it('entryToJson: Float32Array → arrays planos (no {0:...})', () => {
    const e = entryFromCapture(
      { ...PHOTO, adjustedQuad: PHOTO.quad },
      DEVICE,
      'normal',
      'cap-1',
    );
    const j = entryToJson(e);
    expect(Array.isArray(j.autoQuad)).toBe(true);
    expect(Array.isArray(j.adjustedQuad)).toBe(true);
    expect(j.fellBack).toBeNull();
    expect(j.device).toEqual(DEVICE);
    expect(j.autoQuad).toHaveLength(8);
  });
  it('toJsonl: una línea JSON por registro + salto final; vacío → una línea vacía', () => {
    const e = entryFromCapture(PHOTO, DEVICE, 'normal', 'cap-1');
    const lines = toJsonl([e, e]).trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    for (const l of lines) {
      const parsed = JSON.parse(l) as Record<string, unknown>;
      expect(parsed.id).toBe('cap-1');
      expect(parsed.autoQuad).toHaveLength(8);
    }
    expect(toJsonl([])).toBe('\n');
  });
});

describe('F4 dataCollect: dims del pedestal (1600) y cuota', () => {
  it('trainingDims: lado mayor → TRAINING_LONG_SIDE sin hardcodear aspectos', () => {
    expect(TRAINING_LONG_SIDE).toBe(1600);
    expect(trainingDims(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(trainingDims(4000, 3000)).toEqual({ w: 1600, h: 1200 });
    expect(trainingDims(600, 800)).toEqual({ w: 600, h: 800 }); // no se amplía
    expect(trainingDims(0, 4000)).toEqual({ w: 0, h: 0 });
    expect(trainingDims(3000, 4000, 800)).toEqual({ w: 600, h: 800 });
  });
  it('objetivo del dataset y umbral de aviso', () => {
    expect(DATASET_TARGET).toBe(300);
    expect(QUOTA_WARN_FRACTION).toBe(0.7);
    expect(CONDITION_TAGS).toContain('normal');
  });
  it('quotaReport: >70% avisa; ≤70% no; sin estimate → pct null sin aviso', () => {
    expect(quotaReport(70, 100)).toEqual({ pct: 0.7, warn: false });
    expect(quotaReport(71, 100)).toEqual({ pct: 0.71, warn: true });
    expect(quotaReport(null, 100)).toEqual({ pct: null, warn: false });
    expect(quotaReport(0, 100)).toEqual({ pct: null, warn: false }); // 0 de uso
    expect(quotaReport(100, null)).toEqual({ pct: null, warn: false });
  });
});