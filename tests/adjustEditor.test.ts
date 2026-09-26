// tests/adjustEditor.test.ts — matemática pura del editor F4 (orden F4,
// punto 1): la clase es DOM ligera (contexto inyectado), la lógica de
// fracciones/hit/loupe/badges vive en funciones puras testeables en Node.
import { describe, expect, it } from 'vitest';

import {
  EDITOR_DEFAULT_INSET,
  EDITOR_LOUPE_RADIUS,
  EDITOR_LOUPE_SCALE,
  EDITOR_PREVIEW_LONG_SIDE,
  EDITOR_SNAP_MAX_GESTURES,
  EDITOR_SNAP_RADIUS_FRACTION,
  EDITOR_TOUCH_PX,
  clampFraction,
  defaultQuadFractions,
  displayToFractions,
  fractionsToDisplay,
  fractionsToQuadPx,
  hitTestHandle,
  initialQuadFractions,
  loupeRect,
  autoQuadFractions,
  previewDims,
  snapCorner,
  sideReviewBadges,
  AdjustEditor,
} from '../src/ui/AdjustEditor';
import type { Quadrilateral } from '../src/core/types';

const R = { x: 10, y: 20, w: 300, h: 400 }; // DisplayRect de ejemplo

/** Compara fracciones con tolerancia: las fracciones viajan en Float32Array
 *  (0.2 se guarda 0.20000000298023224) y no deben compararse con toEqual. */
function expectFractions(actual: Float32Array, expected: number[]): void {
  expect(Array.from(actual)).toHaveLength(expected.length);
  for (let i = 0; i < expected.length; i++) {
    expect(actual[i]!).toBeCloseTo(expected[i]!, 4);
  }
}

describe('F4 editor: dims del preview', () => {
  it('lado mayor → EDITOR_PREVIEW_LONG_SIDE (1600) o sin escalar si cabe', () => {
    expect(previewDims(3000, 4000)).toEqual({ w: 1200, h: 1600 });
    expect(previewDims(600, 800)).toEqual({ w: 600, h: 800 }); // no se amplía
    expect(previewDims(3000, 4000, 800)).toEqual({ w: 600, h: 800 }); // longSide custom
    expect(previewDims(0, 0)).toEqual({ w: 0, h: 0 });
  });
  it('constantes: preview 1600, loupe 3×, radio 84, touch ≥44, inset 0.2', () => {
    expect(EDITOR_PREVIEW_LONG_SIDE).toBe(1600);
    expect(EDITOR_LOUPE_SCALE).toBe(3);
    expect(EDITOR_LOUPE_RADIUS).toBe(84);
    expect(EDITOR_TOUCH_PX).toBeGreaterThanOrEqual(44);
    expect(EDITOR_DEFAULT_INSET).toBe(0.2);
  });
});

describe('F4 editor: fracciones por defecto y clamp', () => {
  it('defaultQuadFractions: TL,TR,BR,BL al inset 0.2', () => {
    expectFractions(defaultQuadFractions(), [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8]);
  });
  it('inset fuera de rango se clamp a ≤0.49 (quad nunca vacío)', () => {
    const f = defaultQuadFractions(0.9);
    expect(f[0]).toBeCloseTo(0.49, 5);
    expect(f[2]).toBeCloseTo(0.51, 5);
    expect(Array.from(defaultQuadFractions(-1))).toEqual([
      0, 0, 1, 0, 1, 1, 0, 1,
    ]);
  });
  it('clampFraction: [0,1], NaN → 0', () => {
    expect(clampFraction(-0.5)).toBe(0);
    expect(clampFraction(1.5)).toBe(1);
    expect(clampFraction(0.3)).toBeCloseTo(0.3, 5);
    expect(clampFraction(Number.NaN)).toBe(0);
  });
});

describe('F4 editor: fracciones iniciales (ajustado → refinado → detección → defaults)', () => {
  const quad = (c: Array<[number, number]>): Quadrilateral =>
    c.map(([x, y]) => ({ x, y })) as Quadrilateral;

  it('ajustado previo tiene precedencia (reabrir tras editar)', () => {
    const f = initialQuadFractions({
      quad: quad([
        [600, 400],
        [2400, 400],
        [2400, 3600],
        [600, 3600],
      ]),
      quadRefined: quad([
        [630, 440],
        [2370, 440],
        [2370, 3560],
        [630, 3560],
      ]),
      adjustedQuad: quad([
        [900, 1200],
        [2100, 1200],
        [2100, 2800],
        [900, 2800],
      ]),
      frameW: 3000,
      frameH: 4000,
    });
    expectFractions(f, [0.3, 0.3, 0.7, 0.3, 0.7, 0.7, 0.3, 0.7]);
  });
  it('refinado gana a la detección', () => {
    const f = initialQuadFractions({
      quad: quad([
        [600, 400],
        [2400, 400],
        [2400, 3600],
        [600, 3600],
      ]),
      quadRefined: quad([
        [630, 1040],
        [2370, 1040],
        [2370, 2960],
        [630, 2960],
      ]),
      frameW: 3000,
      frameH: 4000,
    });
    expectFractions(f, [0.21, 0.26, 0.79, 0.26, 0.79, 0.74, 0.21, 0.74]);
  });
  it('solo detección → sus fracciones; esquinas fuera de la foto se clampan', () => {
    const f = initialQuadFractions({
      quad: quad([
        [-300, 1000],
        [3300, 1000],
        [3300, 4000],
        [-300, 4000],
      ]),
      quadRefined: null,
      frameW: 3000,
      frameH: 4000,
    });
    expect(f[0]).toBe(0); // -0.1 → 0
    expect(f[2]).toBe(1); // 1.1 → 1
    expect(f[5]).toBe(1); // y 4000/4000 = 1
  });
  it('sin quad (o dims 0 / NaN) → defaults 0.2', () => {
    const none = { quad: null, quadRefined: null, frameW: 3000, frameH: 4000 };
    expectFractions(initialQuadFractions(none), [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8]);
    const nanQuad = quad([
      [Number.NaN, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    expectFractions(
      initialQuadFractions({ quad: nanQuad, quadRefined: null, frameW: 100, frameH: 100 }),
      [0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8],
    );
    expect(initialQuadFractions({ quad: null, quadRefined: null, frameW: 0, frameH: 4000 })[0]).toBeCloseTo(0.2, 5);
  });
});

describe('F4 editor: mapeo display ↔ fracciones', () => {
  it('roundtrip fracción ↔ px del canvas', () => {
    const d = fractionsToDisplay(0.5, 0.5, R);
    expect(d).toEqual({ x: 160, y: 220 });
    const back = displayToFractions(d.x, d.y, R);
    expect(back.x).toBeCloseTo(0.5, 5);
    expect(back.y).toBeCloseTo(0.5, 5);
  });
  it('displayToFractions clamp fuera del rect y guarda con dims 0', () => {
    const f = displayToFractions(-1000, 99999, R);
    expect(f.x).toBe(0);
    expect(f.y).toBe(1);
    expect(displayToFractions(5, 5, { x: 0, y: 0, w: 0, h: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('F4 editor: hit-test de handles (≥44px touch)', () => {
  it('toca el handle TL al centro de su radio de hit', () => {
    // fracción 0.1 → display (10+30, 20+40) = (40, 60)
    const f = new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]);
    expect(hitTestHandle(40, 60, f, R)).toBe(0);
    expect(hitTestHandle(40 + 21, 60, f, R)).toBe(0); // dentro del radio 22
    expect(hitTestHandle(40 + 23, 60, f, R)).toBe(-1); // fuera
    expect(hitTestHandle(40, 380, f, R)).toBe(3); // BL (0.1,0.9) → (40,380)
    expect(hitTestHandle(280, 380, f, R)).toBe(2); // BR (0.9,0.9) → (280,380)
  });
  it('NaN o fracciones malformadas → -1', () => {
    const f = new Float32Array([0.1, 0.1, 0.9, 0.1, 0.9, 0.9, 0.1, 0.9]);
    expect(hitTestHandle(Number.NaN, 60, f, R)).toBe(-1);
    expect(hitTestHandle(40, 60, new Float32Array(7), R)).toBe(-1);
  });
});

describe('F4 editor: loupe y badges', () => {
  it('loupeRect: círculo radio 84 → bbox de 168', () => {
    expect(loupeRect(100, 100)).toEqual({ x: 16, y: 16, w: 168, h: 168 });
    expect(loupeRect(0, 0, 10)).toEqual({ x: -10, y: -10, w: 20, h: 20 });
  });
  it('sideReviewBadges: null → los 4 lados marcan revisión (criterio needsEditorReview)', () => {
    expect(sideReviewBadges(null)).toEqual([true, true, true, true]);
    expect(sideReviewBadges([true, false, false, false])).toEqual([true, false, false, false]);
    expect(sideReviewBadges([false, false, false, false])).toEqual([false, false, false, false]);
  });
});

describe('F4 editor: contrato de cierre', () => {
  it('onConfirm entrega el quad y deja abierto el editor; close lo cierra', async () => {
    const canvas = {
      width: 320,
      height: 240,
      clientWidth: 320,
      clientHeight: 240,
      style: { touchAction: '' },
      ownerDocument: { createElement: () => canvas },
      getContext: () => ({
        clearRect() {}, beginPath() {}, rect() {}, moveTo() {}, lineTo() {},
        closePath() {}, fill() {}, stroke() {}, arc() {}, fillText() {},
        save() {}, clip() {}, fillRect() {}, drawImage() {}, restore() {},
      }),
      addEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0 }),
    };
    const root = { hidden: true } as HTMLElement;
    const confirmed: Quadrilateral[] = [];
    const editor = new AdjustEditor({
      root,
      canvas: canvas as unknown as HTMLCanvasElement,
      makePreview: async () => canvas as unknown as HTMLCanvasElement,
      callbacks: {
        onConfirm: (quad) => confirmed.push(quad),
        onRevert: () => undefined,
      },
    });
    const bitmap = {} as ImageBitmap;
    const q = [
      { x: 10, y: 20 }, { x: 290, y: 20 }, { x: 290, y: 220 }, { x: 10, y: 220 },
    ] as Quadrilateral;
    await editor.open({
      bitmap,
      quad: q,
      quadRefined: null,
      frameW: 300,
      frameH: 200,
    });
    expect(root.hidden).toBe(false);
    editor.onConfirm();
    expect(confirmed).toHaveLength(1);
    expect(root.hidden).toBe(false);
    editor.close();
    expect(root.hidden).toBe(true);
  });
});

describe('F4 editor: fracciones → quad en px de la foto (contrato onConfirm)', () => {
  it('TL,TR,BR,BL multiplicado por frameW/frameH', () => {
    const f = new Float32Array([0.2, 0.2, 0.8, 0.2, 0.8, 0.8, 0.2, 0.8]);
    const q = fractionsToQuadPx(f, 3000, 4000);
    // Float32: 0.2·3000 = 600.0000089 (no exacto) → tolerancia
    expect(q[0]!.x).toBeCloseTo(600, 3);
    expect(q[0]!.y).toBeCloseTo(800, 3);
    expect(q[1]!.x).toBeCloseTo(2400, 3);
    expect(q[1]!.y).toBeCloseTo(800, 3);
    expect(q[2]!.x).toBeCloseTo(2400, 3);
    expect(q[2]!.y).toBeCloseTo(3200, 3);
    expect(q[3]!.x).toBeCloseTo(600, 3);
    expect(q[3]!.y).toBeCloseTo(3200, 3);
  });
});
describe('Editor snap a esquina de página (2026-09-26, petición humana)', () => {
  const FRAME = { frameW: 3000, frameH: 4000 };
  const AUTO: Quadrilateral = [
    { x: 600, y: 400 },
    { x: 2400, y: 400 },
    { x: 2400, y: 3600 },
    { x: 600, y: 3600 },
  ];

  it('autoQuadFractions: quad auto → 8 fracciones; sin auto → null', () => {
    const t = autoQuadFractions({ ...FRAME, quad: AUTO, quadRefined: null });
    expect(t).not.toBeNull();
    expect(t![0]).toBeCloseTo(0.2, 5);
    expect(t![7]).toBeCloseTo(0.9, 5);
    // refined tiene prioridad sobre quad
    const t2 = autoQuadFractions({ ...FRAME, quad: AUTO, quadRefined: AUTO });
    expect(t2).not.toBeNull();
    expect(autoQuadFractions({ ...FRAME, quad: null, quadRefined: null })).toBeNull();
  });

  it('snapCorner: dentro del radio → salta al target; fuera → null (sigue el dedo)', () => {
    const targets = autoQuadFractions({ ...FRAME, quad: AUTO, quadRefined: null })!;
    // A 60px del target TL (radio = 4% de 4000 = 160px) → snap
    const hit = snapCorner(0.2 + 60 / 3000, 0.1, targets, EDITOR_SNAP_RADIUS_FRACTION, 3000, 4000);
    expect(hit).toEqual({ x: targets[0], y: targets[1] });
    // A 400px del target más cercano → sin snap
    const miss = snapCorner(0.2 + 400 / 3000, 0.1, targets, EDITOR_SNAP_RADIUS_FRACTION, 3000, 4000);
    expect(miss).toBeNull();
  });

  it('snapCorner: el más CERCANO gana cuando dos targets están en el radio', () => {
    const targets = new Float32Array([0.2, 0.2, 0.24, 0.2, 0.8, 0.8, 0.2, 0.8]);
    // entre TL y TR (96px de separación en x): a la izquierda → TL
    const hit = snapCorner(0.207, 0.2, targets, EDITOR_SNAP_RADIUS_FRACTION, 3000, 4000);
    expect(hit!.x).toBeCloseTo(0.2, 5);
  });

  it('snapCorner: targets null / radius 0 / dims inválidas → null (sin snap)', () => {
    expect(snapCorner(0.5, 0.5, null, 0.04, 3000, 4000)).toBeNull();
    const t = new Float32Array(8);
    expect(snapCorner(0.5, 0.5, t, 0, 3000, 4000)).toBeNull();
    expect(snapCorner(0.5, 0.5, t, 0.04, 0, 0)).toBeNull();
  });

  it('invariantes: radio 4% del lado largo, máx 3 gestos (origen: petición humana)', () => {
    expect(EDITOR_SNAP_RADIUS_FRACTION).toBe(0.04);
    expect(EDITOR_SNAP_MAX_GESTURES).toBe(3);
  });
});
