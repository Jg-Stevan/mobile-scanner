// src/core/imageModes.ts — modos de procesamiento de la cola multipágina (§5-F5).
// PURO (Node-testeable, sin DOM ni OpenCV): punto blanco paramétrico, curva de
// contraste del modo "Texto claro" y mime por modo. El resto del enhance
// (LAB/CLAHE/remoción de sombras/Sauvola-histórico) vive en
// src/workers/enhanceJs.ts (JS puro dentro del worker — ver desviación D-F5
// en la documentación del pipeline; opencv.js 4.5.5 no expone createCLAHE ni
// COLOR_*Lab, decisión del explorador).
//
// Origen de los valores: PLAN_MAESTRO §F5 (tabla de modos) para los 4 modos
// originales; D-F5-c (2026-09-26, petición humana con video de referencia de
// Adobe Scan) para el modo 'text'. NO recalcular los del plan.

import type { EnhanceMode } from './types';

// --- Constantes D-F5-c: modo "Texto claro" (petición humana 2026-09-26) ---

/** Percentil del histograma que mapea a blanco puro en el modo 'text'
 *  (D-F5-c). Mucho más agresivo que el p97 de natural: en el filtro Texto
 *  claro de Adobe Scan TODO el papel (arrugas, sombras suaves, grano) se
 *  vuelve blanco y solo la tinta sobrevive oscura. 0.80 = el 80% más claro
 *  del fondo quema a 255. Valor INICIAL de ingeniería — validar con el CER
 *  Tesseract por modo + revisión visual humana antes de congelar (misma
 *  disciplina que §F5). */
export const TEXT_CLARO_WHITE_PCT = 0.8;

/** Ganancia de la curva de contraste de medios del modo 'text' (D-F5-c).
 *  Aplicada como S-curve alrededor de TEXT_CLARO_PIVOT: los grises por debajo
 *  del pivote se oscurecen (tinta más marcada) y los de arriba se van a blanco.
 *  1.35 = contraste notorio sin recortar el antialias del texto. Validar con
 *  CER + revisión visual (idem TEXT_CLARO_WHITE_PCT). */
export const TEXT_CLARO_CONTRAST = 1.35;

/** Punto fijo de la S-curve del modo 'text' (D-F5-c): el valor que NO se
 *  modifica por el contraste. 0.72 alto a propósito — el pivote cerca del
 *  papel hace que casi todo lo que no es fondo se oscurezca (es lo que
 *  caracteriza al filtro: papel blanco, tinta dominante). */
export const TEXT_CLARO_PIVOT = 0.72;

/** Calidad JPEG del encode de los modos color/gris/natural/text (§F5: q88-92 →
 *  0.90; hiResCapture ya usa 92 — este 0.90 es el medio del rango del plan). */
export const JPEG_QUALITY = 0.9;

/** Lado mayor de la versión reducida del mapa de iluminación de la remoción
 *  de sombras (§F5 color/gris/natural/text: "división morfológica sobre
 *  versión reducida"). 800px = mapa de iluminación (baja frecuencia) sin pagar
 *  costo full-res; la morfología JS sobre 800×~600 es trivial (<10ms desktop). */
export const ILLUM_MAP_LONG_SIDE = 800;

/** Estirado de punto blanco PARAMÉTRICO (§F5 natural + D-F5-c text): mapea el
 *  percentil `pct` del histograma al blanco puro con estiramiento LINEAL
 *  (slope 255/p, clamp a 255; nada por encima del percentil se quema — el
 *  blanco roza 255). Sin percentil fiable (imagen unicolor) → copia sin
 *  cambios. NO muta la entrada. `whitePointStretch` es el caso §F5 (p97). */
export function whitePointStretchPct(
  gray: Uint8ClampedArray,
  pct: number,
): Uint8ClampedArray {
  const n = gray.length;
  if (!(n > 0)) return new Uint8ClampedArray(0);
  const p = Math.min(1, Math.max(0, pct));
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i++) hist[gray[i]!]! += 1;
  const target = Math.ceil(n * p);
  let acc = 0;
  let pivot = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v]!;
    if (acc >= target) {
      pivot = v;
      break;
    }
  }
  if (pivot <= 0) return gray.slice();
  const scale = 255 / pivot;
  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const v = Math.round(gray[i]! * scale);
    out[i] = v > 255 ? 255 : v;
  }
  return out;
}

/** Estirado de punto blanco del modo natural (§F5): percentil 97 → 255. */
export function whitePointStretch(gray: Uint8ClampedArray): Uint8ClampedArray {
  return whitePointStretchPct(gray, 0.97);
}

/** S-curve de contraste del modo 'text' (D-F5-c): v' = (v − pivote)·contraste
 *  + pivote (en unidades normalizadas), clamp a [0,1]. Con pivote alto
 *  (TEXT_CLARO_PIVOT) y contraste >1: el fondo ya-blanco se mantiene en 255 y
 *  los grises medios (tinta, antialias) se oscurecen — texto claro y marcado
 *  SIN binarización dura (conserva escalas, a diferencia del Sauvola que
 *  sustituía al modo bw). NO muta la entrada. */
export function textClaroContrast(
  gray: Uint8ClampedArray,
  contrast: number = TEXT_CLARO_CONTRAST,
  pivot: number = TEXT_CLARO_PIVOT,
): Uint8ClampedArray {
  const n = gray.length;
  const out = new Uint8ClampedArray(n);
  if (!(n > 0)) return out;
  for (let i = 0; i < n; i++) {
    const v = gray[i]! / 255;
    out[i] = ((v - pivot) * contrast + pivot) * 255;
  }
  return out;
}

/** Normaliza un modo legado/externo al union actual (D-F5-c): las páginas
 *  persistidas con 'bw' (retirado 2026-09-26) cargan como 'text'. Desconocido
 *  → 'color' (el modo por defecto de la cola). */
export function normalizeEnhanceMode(mode: string): EnhanceMode {
  if (mode === 'bw') return 'text';
  if (mode === 'color' || mode === 'gray' || mode === 'natural' || mode === 'text') {
    return mode;
  }
  return 'color';
}

/** Mime del encode por modo (§F5: B/N → PNG histórico; D-F5-c: no queda ningún
 *  modo binarizado → TODO JPEG q88-92 → JPEG_QUALITY). Se conserva el tipo
 *  union 'image/jpeg' | 'image/png' (pdfExport.ts distingue por mime). PURO. */
export function enhanceMime(mode: EnhanceMode): 'image/jpeg' | 'image/png' {
  void mode;
  return 'image/jpeg';
}
