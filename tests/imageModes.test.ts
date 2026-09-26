// tests/imageModes.test.ts — core puro del enhance F5 (§5-F5 + D-F5-c):
// punto blanco paramétrico, S-curve del modo "Texto claro", normalización de
// modos legados y mime por modo. Sin DOM ni OpenCV — arreglos planos.

import { describe, expect, it } from 'vitest';
import {
  JPEG_QUALITY,
  TEXT_CLARO_CONTRAST,
  TEXT_CLARO_PIVOT,
  TEXT_CLARO_WHITE_PCT,
  enhanceMime,
  normalizeEnhanceMode,
  textClaroContrast,
  whitePointStretch,
  whitePointStretchPct,
} from '../src/core/imageModes';

describe('whitePointStretch (p97 → 255 lineal, §F5 natural)', () => {
  it('p97 en 220 → slope 255/220, nada quema por encima', () => {
    // 15 px a 220 y 1 px a 50 → n·0.97 = 15.52 → p97=220.
    const gray = new Uint8ClampedArray(16).fill(220);
    gray[15] = 50;
    const out = whitePointStretch(gray);
    const scale = 255 / 220;
    for (let i = 0; i < 15; i++) expect(out[i]).toBe(255);
    expect(out[15]).toBe(Math.round(50 * scale));
  });

  it('imagen unicolor p97=255 → sin cambios', () => {
    const gray = new Uint8ClampedArray(10 * 10).fill(255);
    expect([...whitePointStretch(gray)].every((v) => v === 255)).toBe(true);
  });

  it('dims inválidas → vacío', () => {
    expect(whitePointStretch(new Uint8ClampedArray(0)).length).toBe(0);
  });
});

describe('whitePointStretchPct (paramétrico D-F5-c, texto claro p80)', () => {
  it('pct 0.5 con histograma controlado → el percentil 50 quema', () => {
    // 10 px a 200 y 6 px a 40: n·0.5 = 8 → p50=200 (acumulado llega en los 200).
    const gray = new Uint8ClampedArray(16);
    gray.fill(200, 0, 10);
    gray.fill(40, 10);
    const out = whitePointStretchPct(gray, 0.5);
    const scale = 255 / 200;
    for (let i = 0; i < 10; i++) expect(out[i]).toBe(255);
    expect(out[10]).toBe(Math.round(40 * scale));
  });

  it('pct agresivo (TEXT_CLARO_WHITE_PCT) quema MÁS píxeles que el p97 de natural', () => {
    // 80% papel @200 + 15% brillo @240 + 5% tinta @40. El acumulador sube
    // desde abajo: p97 → pivot=240 (solo 15 px ≥255); p80 → pivot=200 (todo
    // el papel @200 quema). Mismo papel, blanco distinto: eso es D-F5-c.
    const gray = new Uint8ClampedArray(100);
    gray.fill(200, 0, 80);
    gray.fill(240, 80, 95);
    gray.fill(40, 95);
    const strict = whitePointStretchPct(gray, 0.97);
    const claro = whitePointStretchPct(gray, TEXT_CLARO_WHITE_PCT);
    const white = (a: Uint8ClampedArray) => [...a].filter((v) => v === 255).length;
    expect(white(claro)).toBeGreaterThan(white(strict));
  });

  it('clamp del pct: >1 → 1, <0 → 0 (nunca lanza)', () => {
    const gray = new Uint8ClampedArray(10).fill(128);
    expect(whitePointStretchPct(gray, 2)[0]).toBe(255); // p1=128 → todo a 255
    expect(whitePointStretchPct(gray, -1)).toEqual(gray); // p0=0 → pivot 0 → sin cambios
  });
});

describe('textClaroContrast (S-curve D-F5-c)', () => {
  it('el pivote NO se modifica', () => {
    const gray = new Uint8ClampedArray([Math.round(TEXT_CLARO_PIVOT * 255)]);
    expect(textClaroContrast(gray)[0]).toBe(Math.round(TEXT_CLARO_PIVOT * 255));
  });

  it('grises bajo el pivote se oscurecen; el blanco puro se mantiene', () => {
    const mid = Math.round(0.4 * 255);
    const out = textClaroContrast(new Uint8ClampedArray([mid, 255]));
    expect(out[0]!).toBeLessThan(mid); // tinta más marcada
    expect(out[1]).toBe(255); // papel intacto
  });

  it('con contraste por defecto NO es bimodal (gradiente sobrevive = antialias)', () => {
    const gray = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) gray[i] = i;
    const out = textClaroContrast(gray);
    const distinct = new Set([...out]).size;
    expect(distinct).toBeGreaterThan(16); // Sauvola daba 2; text conserva escalas
  });

  it('usa las constantes D-F5-c por defecto (invariante de contrato)', () => {
    expect(TEXT_CLARO_WHITE_PCT).toBe(0.8);
    expect(TEXT_CLARO_CONTRAST).toBe(1.35);
    expect(TEXT_CLARO_PIVOT).toBe(0.72);
  });
});

describe('normalizeEnhanceMode (migración legado bw → text, D-F5-c)', () => {
  it('bw carga como text; los 4 vigentes pasan igual', () => {
    expect(normalizeEnhanceMode('bw')).toBe('text');
    expect(normalizeEnhanceMode('color')).toBe('color');
    expect(normalizeEnhanceMode('gray')).toBe('gray');
    expect(normalizeEnhanceMode('natural')).toBe('natural');
    expect(normalizeEnhanceMode('text')).toBe('text');
  });

  it('desconocido → color (default de la cola)', () => {
    expect(normalizeEnhanceMode('sepia')).toBe('color');
    expect(normalizeEnhanceMode('')).toBe('color');
  });
});

describe('enhanceMime (D-F5-c: sin modo binarizado → todo JPEG)', () => {
  it('mapea por modo', () => {
    expect(enhanceMime('text')).toBe('image/jpeg');
    expect(enhanceMime('color')).toBe('image/jpeg');
    expect(enhanceMime('gray')).toBe('image/jpeg');
    expect(enhanceMime('natural')).toBe('image/jpeg');
  });

  it('JPEG_QUALITY es el centro del rango §F5 (q88-92)', () => {
    expect(JPEG_QUALITY).toBe(0.9);
    expect(JPEG_QUALITY * 100).toBeGreaterThanOrEqual(88);
    expect(JPEG_QUALITY * 100).toBeLessThanOrEqual(92);
  });
});
