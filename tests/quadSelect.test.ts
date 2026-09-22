// tests/quadSelect.test.ts — selección pura entre aproximaciones (F1).
// Sin OpenCV: polis sintéticos. La geometría (order/validate) ya está probada
// en geometry.test.ts; aquí se prueba la SELECCIÓN (top-N, 4 vértices, fallback).
import { describe, expect, it } from 'vitest';

import type { Quadrilateral } from '../src/core/types';
import { TOP_CONTOURS, scalePoly, selectQuad } from '../src/core/quadSelect';

const FRAME_W = 640;
const FRAME_H = 480;

/** Quad válido grande: 400×300 en 640×480 (área 41.7% > 25%). */
const BIG: Quadrilateral = [
  { x: 120, y: 90 },
  { x: 520, y: 90 },
  { x: 520, y: 390 },
  { x: 120, y: 390 },
];

describe('selectQuad', () => {
  it('elige el mayor válido aunque venga desordenado y no primero', () => {
    const shuffled = [BIG[2], BIG[0], BIG[3], BIG[1]];
    const out = selectQuad(
      [
        { points: [shuffled[0]!, shuffled[1]!], area: 99999 }, // 2 vértices, enorme
        { points: [...shuffled], area: 50000 },
      ],
      FRAME_W,
      FRAME_H,
    );
    expect(out).toEqual(BIG);
  });
  it('salta polis degenerados (empates en orderPoints) sin romper', () => {
    const out = selectQuad(
      [
        {
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 10, y: 10 },
            { x: 10, y: 10 },
          ],
          area: 1000,
        },
        { points: [...BIG], area: 100 },
      ],
      FRAME_W,
      FRAME_H,
    );
    expect(out).toEqual(BIG);
  });
  it('descarta quads que no pasan validateQuad (área < 25%)', () => {
    const tiny = [
      { x: 300, y: 220 },
      { x: 340, y: 220 },
      { x: 340, y: 260 },
      { x: 300, y: 260 },
    ];
    expect(selectQuad([{ points: tiny, area: 1600 }], FRAME_W, FRAME_H)).toBeNull();
  });
  it('solo mira el top-N por área (TOP_CONTOURS=5)', () => {
    expect(TOP_CONTOURS).toBe(5);
    const noise = Array.from({ length: 6 }, (_, i) => ({
      // 6 distractores enormes pero inválidos (triángulos) delante del válido
      points: [
        { x: i, y: 0 },
        { x: i + 50, y: 0 },
        { x: i + 25, y: 40 },
      ],
      area: 100000 - i,
    }));
    const out = selectQuad([...noise, { points: [...BIG], area: 10 }], FRAME_W, FRAME_H);
    expect(out).toBeNull(); // el válido quedó fuera del top-5
    const out2 = selectQuad([...noise.slice(0, 4), { points: [...BIG], area: 10 }], FRAME_W, FRAME_H);
    expect(out2).toEqual(BIG);
  });
  it('vacío → null', () => {
    expect(selectQuad([], FRAME_W, FRAME_H)).toBeNull();
  });
});

describe('scalePoly', () => {
  it('escala anisotrópica por eje (proceso → original)', () => {
    expect(scalePoly([{ x: 100, y: 50 }], 2, 4)).toEqual([{ x: 200, y: 200 }]);
  });
});
