// src/core/warp.ts — dimensiones de salida del warp + parámetros unsharp (PLAN_MAESTRO §F3).
// SIN DOM ni OpenCV: 100% testeable en Node. El aspecto de salida sale del quad
// MEDIDO (largos de lados), NUNCA de aspect ratios hardcodeados: el video es un
// crop del sensor y la foto otro encuadre (T1-R4) — solo el quad manda.

import type { Quadrilateral } from './types';

// --- Constantes DADAS por §F3 (NO recalcular; comentario de origen) ---

/** §F3 (presupuesto de memoria): lado largo máximo de salida del warp
 *  (3500/11 ≈ 318 DPI en carta → cap VALIDADO, sin cambio numérico). */
export const WARP_MAX_LONG_SIDE = 3500;

/** §F3 (pipeline H: "unsharp 0.5/1.5"): cantidad de unsharp masking. */
export const UNSHARP_AMOUNT = 0.5;

/** §F3 (pipeline H: "unsharp 0.5/1.5"): radio/sigma del blur gaussiano del unsharp. */
export const UNSHARP_RADIUS = 1.5;

/** Kernel impar ≥3 derivado de UNSHARP_RADIUS para el GaussianBlur del unsharp
 *  (2·ceil(2·r)+1; r=1.5 → 7). Derivado, no calibrado: cualquier impar ≥3 vale. */
export const UNSHARP_KERNEL_SIZE =
  Math.max(3, 2 * Math.ceil(2 * UNSHARP_RADIUS) + 1);

function sideLen(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Dims de salida del warp desde el quad en PÍXELES de la foto.
 *  Ancho = máx(top, bottom), alto = máx(left, right); escala UNIFORME solo para
 *  reducir hasta WARP_MAX_LONG_SIDE (nunca amplía). Salida entera ≥1px.
 *  Quad degenerado/no-finito → 1×1 (nunca lanza: el worker no debe morir). */
export function computeWarpDims(quad: Quadrilateral): {
  w: number;
  h: number;
} {
  const w0 = Math.max(sideLen(quad[0], quad[1]), sideLen(quad[2], quad[3]));
  const h0 = Math.max(sideLen(quad[1], quad[2]), sideLen(quad[3], quad[0]));
  if (!Number.isFinite(w0) || !Number.isFinite(h0)) {
    return { w: 1, h: 1 };
  }
  const s =
    Math.max(w0, h0) > WARP_MAX_LONG_SIDE
      ? WARP_MAX_LONG_SIDE / Math.max(w0, h0)
      : 1;
  return {
    w: Math.max(1, Math.round(w0 * s)),
    h: Math.max(1, Math.round(h0 * s)),
  };
}
