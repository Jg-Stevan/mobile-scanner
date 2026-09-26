// tests/enhanceJs.test.ts — motor JS puro del enhance (§5-F5, D-F5):
// conversión de color, sombras (división morfológica), CLAHE 2.0 8×8 y la
// orquestación por modo. Sin DOM ni OpenCV: fakes + matemática verificable.
// El worker real (detection.worker) solo encola/encodea; aquí vive la lógica.

import { describe, expect, it } from 'vitest';
import {
  applyGainToRgba,
  claheGray,
  correctedGray,
  enhanceToRgba,
  estimateIllumination,
  grayToRgba,
  labL8,
  labLightness,
  rgbaToGray,
  shadowGain,
} from '../src/workers/enhanceJs';

describe('conversiones de color', () => {
  it('rgbaToGray: luma Rec.601 exacta (77/150/29 >> 8)', () => {
    const d = new Uint8ClampedArray(4).fill(0);
    d[0] = 128;
    d[1] = 128;
    d[2] = 128;
    d[3] = 255;
    // 128·(77+150+29)/256 = 128
    expect(rgbaToGray(d, 1, 1)[0]).toBe(128);
    // rojo puro: 255·77/256 ≈ 76.8 → 76
    const r = new Uint8ClampedArray([255, 0, 0, 255]);
    expect(rgbaToGray(r, 1, 1)[0]).toBe(76);
  });

  it('grayToRgba replica canales con alpha 255', () => {
    const g = new Uint8ClampedArray([10, 200, 7]);
    const out = grayToRgba(g, 3, 1);
    expect([...out]).toEqual([10, 10, 10, 255, 200, 200, 200, 255, 7, 7, 7, 255]);
  });

  it('labLightness: blanco → 100, negro → 0 (CIE 1976 D65)', () => {
    expect(labLightness(255, 255, 255)).toBeCloseTo(100, 1);
    expect(labLightness(0, 0, 0)).toBeCloseTo(0, 1);
    // gris medio sRGB #808080 → L* ≈ 53.6
    expect(labLightness(128, 128, 128)).toBeCloseTo(53.6, 0);
  });

  it('labL8 mantiene paridad con L* CIELAB exacta (±1)', () => {
    for (const rgb of [
      [0, 0, 0],
      [32, 64, 96],
      [128, 128, 128],
      [200, 200, 200],
      [255, 255, 255],
    ] as const) {
      const exact = labLightness(rgb[0], rgb[1], rgb[2]);
      expect(Math.abs(labL8(rgb[0], rgb[1], rgb[2]) - exact)).toBeLessThanOrEqual(1);
    }
    expect(labL8(128, 128, 128)).toBe(54);
    expect(labL8(200, 200, 200)).toBe(81);
  });

  it('rgbaToGray/grayToRgba con dims inválidas → vacío', () => {
    expect(rgbaToGray(new Uint8ClampedArray(0), 0, 0).length).toBe(0);
    expect(grayToRgba(new Uint8ClampedArray(0), 0, 0).length).toBe(0);
  });
});

describe('remoción de sombras (división morfológica, ~§F5)', () => {
  it('gradiente suave se aplana en el interior (gain = mean/illum)', () => {
    // Kernel de morfología = 25px (radio 12) → en el mapa reducido real
    // (800×600) la banda de borde es ~2%; en un test de 32px sería el 37% de
    // la imagen (artefacto de escala, no comportamiento). Usamos 256×256:
    // el INTERIOR (filas 60-196, lejos del borde) debe quedar plano.
    const w = 256;
    const h = 256;
    const gray = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      const v = 50 + ((200 - 50) * y) / (h - 1);
      for (let x = 0; x < w; x++) gray[y * w + x] = v;
    }
    const gain = shadowGain(gray, w, h);
    const out = correctedGray(gray, w, h);
    // Interior: la división anula el gradiente → valor ≈ media (~125).
    const interior: number[] = [];
    for (let y = 60; y < 196; y++) {
      for (let x = 0; x < w; x++) interior.push(out[y * w + x]!);
    }
    const meanIn = interior.reduce((a, b) => a + b, 0) / interior.length;
    const devIn = Math.sqrt(
      interior.reduce((a, b) => a + (b - meanIn) ** 2, 0) / interior.length,
    );
    expect(devIn).toBeLessThan(1);
    // La media del interior queda ≈ la media del gris original (125).
    expect(meanIn).toBeGreaterThan(120);
    expect(meanIn).toBeLessThan(130);
    // Ganancia acotada y positiva en todo el campo.
    expect(Math.min(...gain)).toBeGreaterThan(0);
    expect(Math.max(...gain)).toBeLessThanOrEqual(3);
  });

  it('mapa de iluminación es de baja frecuencia (no sigue el texto)', () => {
    // Página sintética: texto denso en mitad izquierda, fondo plano derecha.
    const w = 64;
    const h = 64;
    const gray = new Uint8ClampedArray(w * h).fill(240);
    for (let y = 8; y < 56; y++) {
      for (let x = 8; x < 32; x++) gray[y * w + x] = 40; // bloque "texto"
    }
    const illum = estimateIllumination(gray, w, h);
    expect(illum.length).toBe(w * h);
    // La iluminación derecha (sin texto) ≈ la izquierda (con texto): la
    // morfología es de baja frecuencia, no se traga los glifos... margen sano:
    // la iluminación varía suave, la diferencia de promedios < 15/255.
    const avgL = (() => {
      let s = 0;
      let c = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < 32; x++) {
          s += illum[y * w + x]!;
          c++;
        }
      }
      return s / c;
    })();
    const avgR = (() => {
      let s = 0;
      let c = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 32; x < 64; x++) {
          s += illum[y * w + x]!;
          c++;
        }
      }
      return s / c;
    })();
    expect(Math.abs(avgL - avgR)).toBeLessThan(15);
  });

  it('entrada unicolor → gain 1 exacto (sin NaN)', () => {
    const gray = new Uint8ClampedArray(32 * 32).fill(128);
    const gain = shadowGain(gray, 32, 32);
    expect([...gain].every((g) => g === 1)).toBe(true);
  });
});

describe('CLAHE (2.0, 8×8, con clip)', () => {
  it('histograma expandido en una imagen de bajo contraste', () => {
    const w = 128;
    const h = 128;
    const gray = new Uint8ClampedArray(w * h);
    for (let i = 0; i < gray.length; i++) gray[i] = 100 + (i % 11); // rango 100..110
    const out = claheGray(gray, w, h);
    const min = Math.min(...out);
    const max = Math.max(...out);
    expect(max - min).toBeGreaterThan(11); // expande el contraste local
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(255);
  });

  it('imagen uniforme → salida uniforme (sin NaN ni ruido)', () => {
    // CLAHE mapea vía CDF: un único bin dominante → el mapa empuja a 255
    // (igual que OpenCV): lo importante es que NO introduzca ruido local.
    const gray = new Uint8ClampedArray(64 * 64).fill(200);
    const out = claheGray(gray, 64, 64);
    expect([...new Set(out)].length).toBe(1);
    expect(out[0]).toBe(255); // CDF total en bin 200 → LUT 255 (determinista)
  });

  it('dims inválidas → vacío', () => {
    expect(claheGray(new Uint8ClampedArray(0), 0, 0).length).toBe(0);
  });
});

describe('applyGainToRgba (clamp y alpha intacto)', () => {
  it('aplica ganancia por píxel sin tocar alpha, clamp a 255', () => {
    const d = new Uint8ClampedArray([200, 100, 50, 255]);
    const gain = new Float32Array([2, 2, 2, 2]);
    const out = applyGainToRgba(d, gain, 1, 1);
    // 200·2 = 400 → 255; 100·2 = 200; 50·2 = 100; alpha intacto.
    expect([...out]).toEqual([255, 200, 100, 255]);
  });
});

describe('enhanceToRgba — orquestación por modo (§F5)', () => {
  function probeImage(w: number, h: number): Uint8ClampedArray {
    // Fondo gris claro con sombra suave (gradiente) + parche oscuro "texto":
    // cualquier modo debe salir opaco, con dims intactas y sin NaN.
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const base = 220 - (y / h) * 120; // sombra: más oscura abajo
        const text = x > 10 && x < 30 && y > 10 && y < 30 ? 60 : 0;
        const v = base - text;
        d[o] = v;
        d[o + 1] = v;
        d[o + 2] = v;
        d[o + 3] = 255;
      }
    }
    return d;
  }

  for (const mode of ['color', 'gray', 'natural', 'text'] as const) {
    it(`${mode}: opaco, dims intactas, sin NaN`, () => {
      const w = 48;
      const h = 48;
      const out = enhanceToRgba(probeImage(w, h), w, h, mode);
      expect(out.length).toBe(w * h * 4);
      for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(255);
      for (let i = 0; i < out.length; i++) expect(Number.isNaN(out[i])).toBe(false);
    });
  }

  it('text: fondo (papel) a blanco, tinta oscura SIN bimodalidad (D-F5-c)', () => {
    const w = 48;
    const h = 48;
    const out = enhanceToRgba(probeImage(w, h), w, h, 'text');
    const at = (x: number, y: number) => (y * w + x) * 4;
    // Papel con sombra corregida + estirado p80 + S-curve = blanco casi puro.
    expect(out[at(40, 4)]!).toBeGreaterThanOrEqual(240);
    // Tinta (60) claramente ms oscura que el papel, NO 0/255 estricto.
    expect(out[at(20, 20)]!).toBeLessThan(180);
    const values = new Set<number>();
    for (let i = 0; i < out.length; i += 4) values.add(out[i]!);
    expect(values.size).toBeGreaterThan(2); // no bimodal (antialias conservado)
  });

  it('gray es gris neutro (R=G=B)', () => {
    const w = 48;
    const h = 48;
    const out = enhanceToRgba(probeImage(w, h), w, h, 'gray');
    for (let i = 0; i < out.length; i += 4) {
      expect(out[i]).toBe(out[i + 1]);
      expect(out[i + 1]).toBe(out[i + 2]);
    }
  });

  it('dims inválidas → vacío (nunca lanza)', () => {
    expect(enhanceToRgba(new Uint8ClampedArray(0), 0, 0, 'color').length).toBe(0);
    expect(enhanceToRgba(new Uint8ClampedArray(3), 1, 1, 'color').length).toBe(0); // 3 < 4
    expect(enhanceToRgba(new Uint8ClampedArray(4), 1, 1, 'color').length).toBe(4); // 1×1 válido
  });

  it('text: la sombra del probe NO sobrevive (fondo colapsado a blanco)', () => {
    // 256×256 (mismo rationale del test de shadowGain: el kernel de morfología
    // solo es baja-frequency a esa escala; a 48px el artefacto de borde domina).
    const w = 256;
    const h = 256;
    const d = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const base = 220 - (y / h) * 120; // sombra: más oscura abajo
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        // Tinta de escala de GLIFO (barras de 4px, contraste relativo 45%):
        // un bloque grande lo absorbería el mapa de iluminación (legítimo —
        // es indistinguible de una sombra a esa escala).
        const ink = x >= 40 && x < 44 ? base * 0.45 : 0;
        const v = base - ink;
        d[o] = v;
        d[o + 1] = v;
        d[o + 2] = v;
        d[o + 3] = 255;
      }
    }
    const out = enhanceToRgba(d, w, h, 'text');
    const at = (x: number, y: number) => (y * w + x) * 4;
    // Fondo arriba (220) vs abajo (100): tras corrección de sombra + p80 la
    // diferencia se colapsa (< 40 de resto) y el papel ronda el blanco.
    expect(Math.abs(out[at(200, 30)]! - out[at(200, 226)]!)).toBeLessThan(40);
    expect(out[at(200, 30)]!).toBeGreaterThanOrEqual(215);
    // La tinta sigue claramente por debajo del papel.
    expect(out[at(41, 128)]!).toBeLessThan(out[at(200, 30)]! - 60);
  });
});