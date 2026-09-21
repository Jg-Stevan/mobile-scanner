// src/core/geometry.ts — núcleo geométrico del cuadrilátero (PLAN_MAESTRO §8, §5-F1/F3).
// SIN DOM ni OpenCV: 100% testeable en Node.
// Los lados se numeran 0=top, 1=right, 2=bottom, 3=left; la esquina n es la
// intersección de los lados (n+3)%4 y n (TL=3+0, TR=0+1, BR=1+2, BL=2+3).

import type { Corner, Quadrilateral } from './types';

export type { Corner, Quadrilateral };

/** Ecuación de recta ax + by + c = 0, normalizada (a²+b² = 1) salvo (0,0,0). */
export interface LineEq {
  a: number;
  b: number;
  c: number;
}

// --- Constantes EXACTAS dadas por el plan (NO recalcular; comentario de origen) ---

/** §5-F1 (Validación estricta): el quad debe cubrir >25% del área del frame. */
export const QUAD_MIN_AREA_RATIO = 0.25;

/** §5-F1 ("aristas mínimas"): cada lado ≥ 5% del lado mayor (rechaza proporciones ~20:1). */
export const MIN_SIDE_RATIO = 0.05;

/** §5-F3 (blindaje 1): banda adaptativa — mínimo de 30px de banda. */
export const BAND_MIN_PX = 30;

/** §5-F3 (blindaje 1): banda adaptativa — 1.5% de la longitud del lado. */
export const BAND_PCT_OF_SIDE = 0.015;

/** §5-F3 (blindaje 2): excluir 12% del extremo de cada lado del ajuste de línea. */
export const TRIM_FRACTION = 0.12;

/** Tolerancia relativa del gate de aspect ratio del video vs. la foto hi-res (F3). */
export const AR_TOLERANCE = 0.01;

/** Reescribe los 4 puntos en orden canónico TL,TR,BR,BL usando suma y diferencia de
 *  coordenadas (§8): TL = mín(x+y), BR = máx(x+y), TR = máx(x−y), BL = mín(x−y). */
export function orderPoints(pts: Corner[]): Quadrilateral {
  if (pts.length !== 4) {
    throw new Error(`orderPoints: se esperan exactamente 4 puntos, recibí ${pts.length}`);
  }
  const sums = pts.map((p) => p.x + p.y);
  const diffs = pts.map((p) => p.x - p.y);
  const idxMin = (v: number[]) => v.indexOf(Math.min(...v));
  const idxMax = (v: number[]) => v.indexOf(Math.max(...v));
  const tl = idxMin(sums);
  const br = idxMax(sums);
  const tr = idxMax(diffs);
  const bl = idxMin(diffs);
  const idxs = new Set([tl, tr, br, bl]);
  if (idxs.size !== 4) {
    throw new Error('orderPoints: cuadrilátero degenerado (coordenadas empatadas)');
  }
  return [pts[tl], pts[tr], pts[br], pts[bl]];
}

/** Área del cuadrilátero por shoelace (siempre ≥ 0). */
export function quadArea(q: Quadrilateral): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Convexidad estricta: los 4 productos vectoriales de aristas consecutivas tienen
 *  el mismo signo y ninguno es ~0 (puntos colineales → no convexo). */
export function isConvex(q: Quadrilateral): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const p0 = q[i];
    const p1 = q[(i + 1) % 4]!;
    const p2 = q[(i + 2) % 4]!;
    const cross = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
    if (Math.abs(cross) < 1e-12) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function orient(p: Corner, q: Corner, r: Corner): number {
  return (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
}

/** Cruce PROPIAMENTE interior de dos segmentos (excluye tocar en extremos). */
function segmentsCross(a: Corner, b: Corner, c: Corner, d: Corner): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** true si las aristas opuestas se cruzan en el interior ("mariposa"). */
export function hasSelfIntersection(q: Quadrilateral): boolean {
  return segmentsCross(q[0], q[1], q[2], q[3]) || segmentsCross(q[1], q[2], q[3], q[0]);
}

/** Razón de cada lado respecto al lado MAYOR: [top, right, bottom, left].
 *  «Rechazar 20:1» (§5-F1) = alguna razón < 0.05. */
export function sideRatios(q: Quadrilateral): [number, number, number, number] {
  const len = (i: number) =>
    Math.hypot(q[(i + 1) % 4]!.x - q[i].x, q[(i + 1) % 4]!.y - q[i].y);
  const sides: [number, number, number, number] = [len(0), len(1), len(2), len(3)];
  const max = Math.max(...sides);
  if (max < 1e-12) return [0, 0, 0, 0];
  return [sides[0] / max, sides[1] / max, sides[2] / max, sides[3] / max];
}

/** Validación estricta (§5-F1): convexo + sin auto-intersección + área >25% del frame
 *  + sides mínimos (MIN_SIDE_RATIO sobre el lado mayor). */
export function validateQuad(q: Quadrilateral, frameW: number, frameH: number): boolean {
  if (!isConvex(q) || hasSelfIntersection(q)) return false;
  if (quadArea(q) <= QUAD_MIN_AREA_RATIO * frameW * frameH) return false;
  const ratios = sideRatios(q);
  for (const r of ratios) {
    if (r < MIN_SIDE_RATIO) return false;
  }
  return true;
}

/** Gate F3 (§5-F3): ¿w1/h1 ≈ w2/h2 dentro de tol relativa? PROHIBIDO hardcodear
 *  ratios (16:9/4:3): todo llega por parámetros. */
export function sameAspectRatio(
  w1: number,
  h1: number,
  w2: number,
  h2: number,
  tol: number = AR_TOLERANCE,
): boolean {
  const r1 = w1 / h1;
  const r2 = w2 / h2;
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return false;
  return Math.abs(r1 - r2) <= tol * Math.max(r1, r2);
}

/** Escala anisotrópica (sx ≠ sy permitido) — útil p. ej. al mapear entre resoluciones. */
export function scaleQuad(q: Quadrilateral, sx: number, sy: number): Quadrilateral {
  return [
    { x: q[0].x * sx, y: q[0].y * sy },
    { x: q[1].x * sx, y: q[1].y * sy },
    { x: q[2].x * sx, y: q[2].y * sy },
    { x: q[3].x * sx, y: q[3].y * sy },
  ];
}

/** Mínimos cuadrados descartando el `trim` de cada extremo (blindaje 2 §5-F3).
 *  Ordena por eje dominante (mayor dispersión) y ajusta la recta al 76% central. */
export function fitLineTrimmed(points: Corner[], trim: number = TRIM_FRACTION): LineEq {
  if (points.length < 2) {
    throw new Error(`fitLineTrimmed: se requieren ≥ 2 puntos (recibí ${points.length})`);
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const dominantX = Math.max(...xs) - Math.min(...xs) >= Math.max(...ys) - Math.min(...ys);
  const sorted = [...points].sort((p, q) => (dominantX ? p.x - q.x : p.y - q.y));
  const trimN = Math.max(0, Math.floor(sorted.length * trim));
  const kept = trimN * 2 < sorted.length ? sorted.slice(trimN, sorted.length - trimN) : sorted;

  if (dominantX) {
    const fit = leastSquares(kept.map((p) => p.x), kept.map((p) => p.y));
    // y = m·x + b → −m·x + y − b = 0  ⇒  a=−m, b=1, c=−b
    if (fit) return normalizeLine(-fit.m, 1, -fit.b);
    const xm = mean(kept.map((p) => p.x));
    return normalizeLine(1, 0, -xm); // vertical
  }
  const fit = leastSquares(kept.map((p) => p.y), kept.map((p) => p.x));
  // x = m·y + b → x − m·y − b = 0  ⇒  a=1, b=−m, c=−b
  if (fit) return normalizeLine(1, -fit.m, -fit.b);
  const ym = mean(kept.map((p) => p.y));
  return normalizeLine(0, 1, -ym); // horizontal
}

/** Ajuste y=m·x+b (o null si degenerado: todos los x iguales). */
function leastSquares(x: number[], y: number[]): { m: number; b: number } | null {
  const n = x.length;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i]!;
    sy += y[i]!;
    sxy += x[i]! * y[i]!;
    sxx += x[i]! * x[i]!;
  }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / den;
  const b = (sy - m * sx) / n;
  return { m, b };
}

/** Normaliza la línea a un vector normal unitario (a²+b²=1). (0,0,0) es inválido. */
function normalizeLine(a: number, b: number, c: number): LineEq {
  const n = Math.hypot(a, b);
  if (n < 1e-12) {
    throw new Error(`normalizeLine: línea degenerada (a=${a}, b=${b})`);
  }
  return { a: a / n, b: b / n, c: c / n };
}

function mean(v: number[]): number {
  return v.reduce((acc, x) => acc + x, 0) / v.length;
}

/** Intersección de dos rectas; null si casi paralelas (|den| < 1e-12). */
export function intersectLines(l1: LineEq, l2: LineEq): Corner | null {
  const den = l1.a * l2.b - l2.a * l1.b;
  if (Math.abs(den) < 1e-12) return null;
  const x = (l1.b * l2.c - l2.b * l1.c) / den;
  const y = (l1.c * l2.a - l2.c * l1.a) / den;
  return { x, y };
}

/** Resultado del refinado por líneas (blindaje 3 §5-F3). */
export interface RefineResult {
  quad: Quadrilateral;
  /** 0=top, 1=right, 2=bottom, 3=left — true si ese lado cayó al quad 480p. */
  fellBack: [boolean, boolean, boolean, boolean];
}

/** 4 rectas (una por lado) → 4 intersecciones en orden TL,TR,BR,BL.
 *  Si alguna esquina es null o la validación global falla (convexidad +
 *  no-auto-intersección + área>0), fallback POR LADO al quad de entrada:
 *  - fellBack[i]=true cuando AMBAS esquinas del lado i son null;
 *  - una esquina null aislada marca sus 2 lados adyacentes (TL depende de lados 3+0);
 *  - validación global fallida con todas las esquinas presentes → fallback de los 4. */
export function refineQuadFromLines(
  topL: LineEq,
  rightL: LineEq,
  bottomL: LineEq,
  leftL: LineEq,
  fallback: Quadrilateral,
): RefineResult {
  const refined: (Corner | null)[] = [
    intersectLines(leftL, topL), // TL (lados 3+0)
    intersectLines(topL, rightL), // TR (lados 0+1)
    intersectLines(rightL, bottomL), // BR (lados 1+2)
    intersectLines(bottomL, leftL), // BL (lados 2+3)
  ];
  const bad = refined.map((c) => c === null);

  // Caso feliz: todas presentes y cuadrilátero válido.
  const r0 = refined[0];
  const r1 = refined[1];
  const r2 = refined[2];
  const r3 = refined[3];
  if (r0 && r1 && r2 && r3) {
    const cand: Quadrilateral = [r0, r1, r2, r3];
    if (isConvex(cand) && !hasSelfIntersection(cand) && quadArea(cand) > 0) {
      return { quad: cand, fellBack: [false, false, false, false] };
    }
  }

  const fellBack: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  if (bad.some(Boolean)) {
    // Lado i cae si AMBAS esquinas que lo delimitan son null.
    for (let i = 0; i < 4; i++) {
      fellBack[i] = bad[i] === true && bad[(i + 1) % 4] === true;
    }
    // Esquina null aislada (ningún lado con ambas null): caen sus 2 lados adyacentes,
    // (n+3)%4 y n, para que esa esquina siempre tenga fallback de 480p.
    for (let i = 0; i < 4; i++) {
      if (bad[i] && !fellBack[(i + 3) % 4] && !fellBack[i]) {
        fellBack[(i + 3) % 4] = true;
        fellBack[i] = true;
      }
    }
  } else {
    // Todas las esquinas existen pero la validación global falló: blindaje 3 → 4/4.
    fellBack[0] = true;
    fellBack[1] = true;
    fellBack[2] = true;
    fellBack[3] = true;
  }

  // Ensamblado: la esquina n usa la del quad 480p si cualquiera de sus 2 lados cayó;
  // si no, la refinada (el invariante garantiza que entonces no es null).
  const quad = [0, 1, 2, 3].map((i) => {
    if (fellBack[(i + 3) % 4] || fellBack[i]) return fallback[i];
    const rc = refined[i];
    if (rc === null) {
      throw new Error('refineQuadFromLines: invariante roto (esquina null sin fallback)');
    }
    return rc;
  }) as unknown as Quadrilateral;

  return { quad, fellBack };
}