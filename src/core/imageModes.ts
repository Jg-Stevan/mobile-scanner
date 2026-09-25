// src/core/imageModes.ts — modos de procesamiento de la cola multipágina (§5-F5).
// PURO (Node-testeable, sin DOM ni OpenCV): B/N por Sauvola con ventana
// parametrizada por DPI y estirado de punto blanco. El resto del enhance
// (LAB/CLAHE/remoción de sombras) vive en src/workers/enhanceJs.ts (JS puro
// dentro del worker — ver desviación D-F5 en la documentación del pipeline;
// opencv.js 4.5.5 no expone createCLAHE ni COLOR_*Lab, decisión del explorador).
//
// Origen de los valores: PLAN_MAESTRO §F5 (tabla de modos), NO recalcular.

import type { EnhanceMode } from './types';

// --- Constantes DADAS por §F5 (comentario de origen en cada una) ---

/** §F5 (tabla de modos, B/N): "Sauvola con ventana parametrizada por DPI
 *  (~2% del lado menor ≈ 50-70px @300DPI, no píxeles fijos)". Fracción del
 *  lado menor que define la ventana de Sauvola. A ~300 DPI (2550px lado
 *  menor) da 51px — dentro del rango esperado 50-70. */
export const SAUVOLA_WINDOW_PCT = 0.02;

/** Cota INFERIOR de la ventana de Sauvola (px, impar). Origen: ingeniería F5 —
 *  ventanas <15px sobre-ajustan el texto y son ruido en imágenes pequeñas
 *  (la v0 del spike lo confirmó en miniaturas). */
export const SAUVOLA_WINDOW_MIN = 15;

/** Cota SUPERIOR de la ventana de Sauvola (px, impar). Origen: ingeniería F5 —
 *  el costo de Sauvola es O(px) con el sliding window del core, PERO la cota
 *  acota el radio de borde sin información y la memoria O(W) del integrador;
 *  101 cubre hasta ~5050px de lado menor (más que el cap de 3500px del warp). */
export const SAUVOLA_WINDOW_MAX = 101;

/** Kappa de Sauvola (estándar de la fórmula clásica Sauvola & Pietikäinen,
 *  documento de 2000; el rango típico de la literatura es 0.2-0.5 → 0.34). */
export const SAUVOLA_K = 0.34;

/** Rango dinámico R del fondo en Sauvola (para 8 bits: 128, estándar de la
 *  fórmula clásica — el fondo tipográfico esperado es ≈128). */
export const SAUVOLA_R = 128;

/** Calidad JPEG del encode de los modos color/gris/natural (§F5: q88-92 →
 *  0.90; hiResCapture ya usa 92 — este 0.90 es el medio del rango del plan). */
export const JPEG_QUALITY = 0.9;

/** Lado mayor de la versión reducida del mapa de iluminación de la remoción
 *  de sombras (§F5 color/gris/bn/natural: "división morfológica sobre versión
 *  reducida"). 800px = mapa de iluminación (baja frecuencia) sin pagar costo
 *  full-res; la morfología JS sobre 800×~600 es trivial (<10ms desktop). */
export const ILLUM_MAP_LONG_SIDE = 800;

/** Ventana de Sauvola desde las dims de la página (px, SIEMPRE impar):
 *  ~2% del lado menor (§F5), clamp a [MIN, MAX], forzada a impar para que el
 *  kernel deslizante tenga centro. Dims inválidas → 1 (nunca lanza). */
export function sauvolaWindow(
  w: number,
  h: number,
  min = SAUVOLA_WINDOW_MIN,
  max = SAUVOLA_WINDOW_MAX,
  pct = SAUVOLA_WINDOW_PCT,
): number {
  if (!(w > 0) || !(h > 0)) return 1;
  const raw = Math.round(pct * Math.min(w, h));
  const clamped = Math.max(min, Math.min(max, raw));
  const odd = clamped % 2 === 0 ? clamped - 1 : clamped;
  return Math.max(1, odd);
}

/** Binarización Sauvola local sobre gris (0-255). Ventana deslizante POR FILA
 *  con acumuladores de columna: memoria O(W) (dos Float64Array de ancho W),
 *  costo O(W·H) — nunca materializa la ventana completa. Fórmula clásica:
 *  T(x,y) = μ·(1 + k·(σ/R − 1)); píxel > T → 255 (fondo), si no 0 (tinta).
 *  Bordes: la ventana se recorta al borde (aprox. estándar, documentada).
 *  Dims inválidas → Uint8ClampedArray vacío. La imagen de entrada NO se muta. */
export function sauvolaBinarize(
  gray: Uint8ClampedArray,
  w: number,
  h: number,
  window: number = sauvolaWindow(w, h),
): Uint8ClampedArray {
  if (!(w > 0) || !(h > 0) || gray.length < w * h) return new Uint8ClampedArray(0);
  const win = window % 2 === 0 ? window - 1 : window;
  if (win <= 0) return gray.slice();
  const half = (win - 1) >> 1;
  const out = new Uint8ClampedArray(w * h);

  // Acumuladores de columna para la ventana vertical [y0..y1] del pixel (x,y).
  const colSum = new Float64Array(w);
  const colSumSq = new Float64Array(w);
  let y0 = 0;
  let y1 = Math.min(h - 1, half);
  const addRow = (y: number): void => {
    const off = y * w;
    for (let x = 0; x < w; x++) {
      const v = gray[off + x]!;
      colSum[x]! += v;
      colSumSq[x]! += v * v;
    }
  };
  const subRow = (y: number): void => {
    const off = y * w;
    for (let x = 0; x < w; x++) {
      const v = gray[off + x]!;
      colSum[x]! -= v;
      colSumSq[x]! -= v * v;
    }
  };
  for (let y = 0; y <= y1; y++) addRow(y);

  for (let y = 0; y < h; y++) {
    // Ventana vertical centrada en y: [max(0,y-half), min(h-1,y+half)].
    const wantY0 = Math.max(0, y - half);
    const wantY1 = Math.min(h - 1, y + half);
    while (y0 < wantY0) {
      subRow(y0);
      y0++;
    }
    while (y1 < wantY1) {
      y1++;
      addRow(y1);
    }
    while (y0 > wantY0) {
      y0--;
      addRow(y0);
    }
    while (y1 > wantY1) {
      subRow(y1);
      y1--;
    }

    // Barrido horizontal con la misma ventana deslizante, costo O(1) por px.
    let x0 = 0;
    let x1 = Math.min(w - 1, half);
    let sum = 0;
    let sumSq = 0;
    for (let x = x0; x <= x1; x++) {
      sum += colSum[x]!;
      sumSq += colSumSq[x]!;
    }
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      const wantX0 = Math.max(0, x - half);
      const wantX1 = Math.min(w - 1, x + half);
      while (x0 < wantX0) {
        sum -= colSum[x0]!;
        sumSq -= colSumSq[x0]!;
        x0++;
      }
      while (x1 < wantX1) {
        x1++;
        sum += colSum[x1]!;
        sumSq += colSumSq[x1]!;
      }
      while (x0 > wantX0) {
        x0--;
        sum += colSum[x0]!;
        sumSq += colSumSq[x0]!;
      }
      while (x1 > wantX1) {
        sum -= colSum[x1]!;
        sumSq -= colSumSq[x1]!;
        x1--;
      }
      const cnt = (x1 - x0 + 1) * (y1 - y0 + 1);
      const mu = sum / cnt;
      const sigma = Math.sqrt(Math.max(0, sumSq / cnt - mu * mu));
      const t = mu * (1 + SAUVOLA_K * (sigma / SAUVOLA_R - 1));
      out[rowOff + x] = gray[rowOff + x]! > t ? 255 : 0;
    }
  }
  return out;
}

/** Estirado de punto blanco (modo natural, §F5): mapea el percentil 97 del
 *  histograma al blanco puro con estiramiento LINEAL (slope 255/p97, clamp a
 *  255; nada por encima del p97 se quema — el blanco roza 255). Sin p97
 *  fiable (imagen unicolor) → copia sin cambios. NO muta la entrada. */
export function whitePointStretch(gray: Uint8ClampedArray): Uint8ClampedArray {
  const n = gray.length;
  if (!(n > 0)) return new Uint8ClampedArray(0);
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[gray[i]!]! += 1;
  const target = Math.ceil(n * 0.97);
  let acc = 0;
  let p97 = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v]!;
    if (acc >= target) {
      p97 = v;
      break;
    }
  }
  if (p97 <= 0) return gray.slice();
  const scale = 255 / p97;
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const v = Math.round(gray[i]! * scale);
    out[i] = v > 255 ? 255 : v;
  }
  return out;
}

/** Mime del encode por modo (§F5: B/N → PNG sin ringing de JPEG; el resto
 *  JPEG q88-92 → JPEG_QUALITY). PURO e importable por el worker y el export. */
export function enhanceMime(mode: EnhanceMode): 'image/jpeg' | 'image/png' {
  return mode === 'bw' ? 'image/png' : 'image/jpeg';
}