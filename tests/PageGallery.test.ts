// tests/PageGallery.test.ts — matemática pura de la galería multipágina
// (§5-F5): reorder (relocate), miniaturas, umbral de arrastre 44px e
// hit-test de índice por centro. El DOM (clase PageGallery) se cubre en el
// E2E del harness con el navegador real.

import { describe, expect, it } from 'vitest';
import {
  indexAtPoint,
  modeLabel,
  preparePages,
  relocate,
  shouldStartDrag,
  thumbDims,
} from '../src/ui/PageGallery';

describe('relocate (reorder de la cola)', () => {
  it('mueve dentro de la lista (0 → 2)', () => {
    expect(relocate(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('mueve al inicio y al final', () => {
    expect(relocate(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(relocate(['a', 'b', 'c'], 0, 3)).toEqual(['b', 'c', 'a']); // to==len → fin
  });

  it('ídolo: mismo índice → copia sin cambios', () => {
    expect(relocate(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('índices inválidos → copia intacta; no muta entrada', () => {
    const ids = ['a', 'b'];
    expect(relocate(ids, -1, 0)).toEqual(['a', 'b']);
    expect(relocate(ids, 5, 0)).toEqual(['a', 'b']);
    expect(ids).toEqual(['a', 'b']);
  });
});

describe('thumbDims (miniaturas ~200px, contain)', () => {
  it('portrait 2040×2640 → 155×200 (lado mayor 200)', () => {
    const d = thumbDims(2040, 2640);
    expect(d.w).toBe(155); // 2040·(200/2640) = 154.5 → 155
    expect(d.h).toBe(200);
  });

  it('no amplía imágenes pequeñas', () => {
    const d = thumbDims(100, 80);
    expect(d).toEqual({ w: 100, h: 80 });
  });
});

describe('shouldStartDrag (umbral 44px touch — orden F5)', () => {
  it('bajo el umbral no arrastra; en/por encima sí', () => {
    expect(shouldStartDrag(10, 10)).toBe(false); // 14.1 < 44
    expect(shouldStartDrag(40, 0)).toBe(false);
    expect(shouldStartDrag(30, 30)).toBe(false); // 42.4 < 44
    expect(shouldStartDrag(44, 0)).toBe(true);
    expect(shouldStartDrag(0, 44)).toBe(true);
    expect(shouldStartDrag(32, 32)).toBe(true); // 45.3 ≥ 44
  });
});

describe('indexAtPoint (centro más cercano)', () => {
  const boxes = [
    { x: 0, y: 0, w: 100, h: 100 },
    { x: 100, y: 0, w: 100, h: 100 },
    { x: 0, y: 100, w: 100, h: 100 },
  ];

  it('elige la miniatura cuyo centro está más cerca', () => {
    expect(indexAtPoint(10, 10, boxes)).toBe(0);
    expect(indexAtPoint(150, 50, boxes)).toBe(1);
    expect(indexAtPoint(50, 150, boxes)).toBe(2);
  });

  it('sin cajas → -1', () => {
    expect(indexAtPoint(0, 0, [])).toBe(-1);
  });
});

describe('preparePages (modo global al export)', () => {
  it('procesa cada warped con el modo vigente sin mutar el store', async () => {
    const pages = [
      { id: 'a', blob: new Blob(['raw-a']), mode: 'color' as const, order: 0, ts: 1 },
      { id: 'b', blob: new Blob(['raw-b']), mode: 'natural' as const, order: 1, ts: 2 },
    ];
    const prepared = await preparePages(pages, 'bw', async (source, mode) => {
      expect(mode).toBe('bw');
      return new Blob([`${await source.text()}:${mode}`]);
    });
    expect(prepared.map((p) => p.mode)).toEqual(['bw', 'bw']);
    expect(await prepared[0]!.blob.text()).toBe('raw-a:bw');
    expect(pages[0]!.mode).toBe('color');
  });

  it('falla rápido si el worker no devuelve blob', async () => {
    const pages = [
      { id: 'a', blob: new Blob(['raw']), mode: 'color' as const, order: 0, ts: 1 },
    ];
    await expect(
      preparePages(pages, 'color', async () => null as unknown as Blob),
    ).rejects.toThrow('enhance falló para la página 1');
  });
});

describe('modeLabel (nomenclatura §F5)', () => {
  it('4 modos', () => {
    expect(modeLabel('color')).toBe('Color');
    expect(modeLabel('gray')).toBe('Gris');
    expect(modeLabel('bw')).toBe('B/N');
    expect(modeLabel('natural')).toBe('Natural');
  });
});