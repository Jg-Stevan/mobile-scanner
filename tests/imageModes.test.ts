// tests/imageModes.test.ts — core puro del enhance F5 (§5-F5): ventana de
// Sauvola, binarización (fórmula clásica), punto blanco p97 y mime por modo.
// Sin DOM ni OpenCV — fakes y arreglos planos.

import { describe, expect, it } from 'vitest';
import {
  JPEG_QUALITY,
  SAUVOLA_WINDOW_MAX,
  SAUVOLA_WINDOW_MIN,
  SAUVOLA_WINDOW_PCT,
  enhanceMime,
  sauvolaBinarize,
  sauvolaWindow,
  whitePointStretch,
} from '../src/core/imageModes';

describe('sauvolaWindow (ventana ~2% del lado menor, clamp, impar)', () => {
  it('usa el lado menor al 2%', () => {
    // 300 DPI ~2480px de lado menor (A4) → 0.02·2480 = 49.6 → round 50 → 49.
    expect(sauvolaWindow(3508, 2480)).toBe(49);
    expect(sauvolaWindow(1000, 1000)).toBe(19); // 0.02·1000 = 20 → par → 19
  });

  it('clamps dentro de [15, 101]', () => {
    expect(sauvolaWindow(100, 100)).toBe(SAUVOLA_WINDOW_MIN); // 2 < 15 → 15
    expect(sauvolaWindow(10000, 10000)).toBe(SAUVOLA_WINDOW_MAX); // 200 > 101 → 101
  });

  it('siempre devuelve impar', () => {
    for (const n of [100, 200, 500, 2480, 3000]) {
      expect(sauvolaWindow(n, n) % 2).toBe(1);
    }
  });

  it('dims inválidas → 1 (nunca lanza)', () => {
    expect(sauvolaWindow(0, 100)).toBe(1);
    expect(sauvolaWindow(-5, 100)).toBe(1);
    expect(sauvolaWindow(NaN, 100)).toBe(1);
  });
});

describe('sauvolaBinarize (fórmula clásica sobre gris plano)', () => {
  it('plano claro → todo fondo (255)', () => {
    const gray = new Uint8ClampedArray(40 * 40).fill(240);
    const out = sauvolaBinarize(gray, 40, 40);
    expect(out.length).toBe(1600);
    expect([...out].every((v) => v === 255)).toBe(true);
  });

  it('texto oscuro sobre fondo claro → tinta 0, fondo 255', () => {
    const w = 40;
    const h = 40;
    const gray = new Uint8ClampedArray(w * h).fill(240);
    // Bloque "texto" 10×10 en el centro a valor 30.
    for (let y = 15; y < 25; y++) {
      for (let x = 15; x < 25; x++) gray[y * w + x] = 30;
    }
    const out = sauvolaBinarize(gray, w, h);
    let ink = 0;
    let bg = 0;
    for (let i = 0; i < out.length; i++) {
      if (out[i] === 0) ink++;
      else if (out[i] === 255) bg++;
    }
    // 100 px de tinta (el 10×10 central) al menos; el resto fondo.
    expect(ink).toBeGreaterThanOrEqual(100);
    expect(bg).toBeGreaterThan(1400);
  });

  it('dims inválidas → arreglo vacío', () => {
    expect(sauvolaBinarize(new Uint8ClampedArray(0), 0, 0).length).toBe(0);
    expect(sauvolaBinarize(new Uint8ClampedArray(4), 2, 2).length).toBe(4);
  });

  it('no muta la entrada', () => {
    const gray = new Uint8ClampedArray(16 * 16).fill(128);
    gray[5] = 60;
    const copy = gray.slice();
    sauvolaBinarize(gray, 16, 16);
    expect(gray).toEqual(copy);
  });
});

describe('whitePointStretch (p97 → 255 lineal)', () => {
  it('p97 en 219 → slope 255/219, nada quema por encima', () => {
    // Histograma: 48% del píxel en 219 (~4.7 px → 4 de 16 = 25%... mejor
    // histograma controlado: 15 px a 220 y 1 px a 50 → n·0.97 = 15.52 → p97=220).
    const gray = new Uint8ClampedArray(16).fill(220);
    gray[15] = 50;
    const out = whitePointStretch(gray);
    const scale = 255 / 220;
    // 220·1.159 = 255 (clamp), 50·1.159 ≈ 58.
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

describe('enhanceMime (B/N → png; resto jpeg)', () => {
  it('mapea por modo', () => {
    expect(enhanceMime('bw')).toBe('image/png');
    expect(enhanceMime('color')).toBe('image/jpeg');
    expect(enhanceMime('gray')).toBe('image/jpeg');
    expect(enhanceMime('natural')).toBe('image/jpeg');
  });

  it('JPEG_QUALITY es el centro del rango §F5 (q88-92)', () => {
    expect(JPEG_QUALITY).toBe(0.9);
    expect(JPEG_QUALITY * 100).toBeGreaterThanOrEqual(88);
    expect(JPEG_QUALITY * 100).toBeLessThanOrEqual(92);
  });

  it('la ventana por defecto usa las constantes §F5', () => {
    // A4 @300dpi (2480 de lado menor): 0.02·2480 = 49.6 → 50 → par → 49.
    expect(sauvolaWindow(3508, 2480)).toBe(49);
    expect(sauvolaWindow(3508, 2480)).toBe(
      sauvolaWindow(3508, 2480, SAUVOLA_WINDOW_MIN, SAUVOLA_WINDOW_MAX, SAUVOLA_WINDOW_PCT),
    );
  });
});