// src/core/quadSelect.ts — elección del cuadrilátero entre aproximaciones (F1).
// PURO (sin DOM ni OpenCV): recibe polígonos ya aproximados (el lado cv hace
// findContours + approxPolyDP) con sus áreas, y aplica la geometría aprobada
// de core/geometry.ts (orderPoints + validateQuad — SOLO consumo, sin editar).
// Contrato de unidades: points y frameW/H en píxeles del MISMO frame
// (el pipeline convierte a coords del frame ORIGINAL antes de llamar).

import { orderPoints, validateQuad } from './geometry';
import type { Corner, Quadrilateral } from './types';

/** Nº de contornos top por área que se evalúan (F1: el resto es ruido). */
export const TOP_CONTOURS = 5;

/** Polígono aproximado con su área (lado cv: approxPolyDP + contourArea). */
export interface ScoredPoly {
  points: Corner[];
  area: number;
}

/** Top-N por área → solo 4 vértices → orden canónico → validación estricta.
 *  El primer válido gana; null si ninguno pasa (el protocolo ya maneja null). */
export function selectQuad(
  polys: ScoredPoly[],
  frameW: number,
  frameH: number,
  topN: number = TOP_CONTOURS,
): Quadrilateral | null {
  const top = [...polys].sort((a, b) => b.area - a.area).slice(0, Math.max(0, topN));
  for (const poly of top) {
    if (poly.points.length !== 4) continue;
    let ordered: Quadrilateral;
    try {
      ordered = orderPoints(poly.points);
    } catch {
      continue; // degenerado (empates) → siguiente candidato
    }
    if (validateQuad(ordered, frameW, frameH)) return ordered;
  }
  return null;
}

/** Escala anisotrópica de polígono (proceso → frame original, sx≠sy).
 *  Las fracciones se preservan por eje: es lo que hace invariante el mapeo. */
export function scalePoly(points: Corner[], sx: number, sy: number): Corner[] {
  return points.map((p) => ({ x: p.x * sx, y: p.y * sy }));
}
