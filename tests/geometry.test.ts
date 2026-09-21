// tests/geometry.test.ts — tests del núcleo geométrico (T2 · PLAN_MAESTRO §5-F1/F3, §8).
// 7 grupos exactos según la especificación de tarea T2. Sin DOM: corre en Node.
import { describe, expect, it } from 'vitest';
import type { Corner, Quadrilateral } from '../src/core/types';
import {
  fitLineTrimmed,
  hasSelfIntersection,
  intersectLines,
  isConvex,
  orderPoints,
  quadArea,
  refineQuadFromLines,
  sameAspectRatio,
  scaleQuad,
  sideRatios,
  validateQuad,
  type LineEq,
} from '../src/core/geometry';

/** PRNG determinista (mulberry32) para ruido gaussiano reproducible en tests. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let z = Math.imul(t ^ (t >>> 15), 1 | t) >>> 0;
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Recta normalizada que pasa por dos puntos (a·x + b·y + c = 0). */
function lineFromPoints(p: Corner, q: Corner): LineEq {
  const a = p.y - q.y;
  const b = q.x - p.x;
  const c = p.x * q.y - q.x * p.y;
  const n = Math.hypot(a, b);
  if (n < 1e-12) throw new Error('lineFromPoints: puntos coincidentes');
  return { a: a / n, b: b / n, c: c / n };
}

describe('1. orderPoints — quads rotados ~10° se ordenan TL,TR,BR,BL', () => {
  it('rect 800×600 rotado 10° → orden canónico correcto', () => {
    const cx = 500;
    const cy = 500;
    const th = (10 * Math.PI) / 180;
    const rot = (x0: number, y0: number): Corner => {
      const x = x0 - cx;
      const y = y0 - cy;
      return {
        x: cx + x * Math.cos(th) - y * Math.sin(th),
        y: cy + x * Math.sin(th) + y * Math.cos(th),
      };
    };
    const tl = rot(cx - 400, cy - 300);
    const tr = rot(cx + 400, cy - 300);
    const br = rot(cx + 400, cy + 300);
    const bl = rot(cx - 400, cy + 300);

    const ordered = orderPoints([br, tl, bl, tr]);
    const close = (a: Corner, b: Corner) => {
      expect(a.x).toBeCloseTo(b.x, 5);
      expect(a.y).toBeCloseTo(b.y, 5);
    };
    close(ordered[0], tl);
    close(ordered[1], tr);
    close(ordered[2], br);
    close(ordered[3], bl);
  });
});

describe('2. scaleQuad — escalado uniforme y anisotrópico exacto', () => {
  const base: Quadrilateral = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ];
  it('uniforme (2,2) con valores exactos', () => {
    expect(scaleQuad(base, 2, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 0, y: 10 },
    ]);
  });
  it('anisotrópico (1.5, 2) con valores exactos', () => {
    expect(scaleQuad(base, 1.5, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 15, y: 10 },
      { x: 0, y: 10 },
    ]);
  });
});

describe('3. sameAspectRatio — gate F3 (bug §5-F3: video 16:9 vs foto 4:3)', () => {
  it('stream 1920×1080 vs foto 4000×3000 → false (ratio distinto)', () => {
    expect(sameAspectRatio(1920, 1080, 4000, 3000)).toBe(false);
  });
  it('stream 1920×1080 vs foto 3840×2160 → true (mismo ratio)', () => {
    expect(sameAspectRatio(1920, 1080, 3840, 2160)).toBe(true);
  });
});

describe('4. fitLineTrimmed — outliers en extremos (blindaje 2 §5-F3)', () => {
  // Línea exacta y=2x+10 con un outlier lejano en cada extremo.
  const pts: Corner[] = [
    { x: 0, y: 100 },
    { x: 1, y: 12 },
    { x: 2, y: 14 },
    { x: 3, y: 16 },
    { x: 4, y: 18 },
    { x: 5, y: 20 },
    { x: 6, y: 22 },
    { x: 7, y: 24 },
    { x: 8, y: 26 },
    { x: 9, y: 28 },
    { x: 10, y: -80 },
  ];
  const slopeOf = (l: LineEq) => -l.a / l.b;

  it('con trim por defecto recupera la pendiente (tol 1e-6)', () => {
    const { a, b } = fitLineTrimmed(pts);
    expect(Math.abs(slopeOf({ a, b, c: 0 }) - 2)).toBeLessThanOrEqual(1e-6);
  });
  it('sin trim (0) los outliers de extremo sesgan la pendiente', () => {
    const biased = fitLineTrimmed(pts, 0);
    expect(Math.abs(slopeOf(biased) - 2)).toBeGreaterThan(0.5);
  });
  it('puntos degenerados (todos iguales) → recta vertical normalizada', () => {
    const l = fitLineTrimmed([{ x: 5, y: 7 }, { x: 5, y: 7 }]);
    expect(Math.abs(l.a - 1)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(l.b)).toBeLessThanOrEqual(1e-9);
    expect(Math.abs(l.c + 5)).toBeLessThanOrEqual(1e-9);
  });
});

describe('5. intersectLines — perpendiculares exactas y casi paralelas → null', () => {
  it('perpendiculares conocidas → esquina exacta', () => {
    const vertical: LineEq = { a: 1, b: 0, c: -3 }; // x = 3
    const horizontal: LineEq = { a: 0, b: 1, c: 2 }; // y = -2
    expect(intersectLines(vertical, horizontal)).toEqual({ x: 3, y: -2 });
    expect(intersectLines(horizontal, vertical)).toEqual({ x: 3, y: -2 });
  });
  it('casi paralelas (|den| < 1e-12) → null', () => {
    const l1: LineEq = { a: 1, b: -1, c: 0 }; // y = x
    const l2: LineEq = { a: 1, b: -1 + 1e-13, c: 0 };
    expect(intersectLines(l1, l2)).toBeNull();
    expect(intersectLines(l2, l1)).toBeNull();
  });
  it('exactamente paralelas → null', () => {
    const l1: LineEq = { a: 1, b: -1, c: 0 };
    const l2: LineEq = { a: 2, b: -2, c: 1 };
    expect(intersectLines(l1, l2)).toBeNull();
  });
});

describe('6. refineQuadFromLines — blindaje 3 §5-F3', () => {
  it('GT sintético + ruido gaussiano ±3px → refinado a ±0.5px del GT', () => {
    const gt: Quadrilateral = [
      { x: 150, y: 120 },
      { x: 1050, y: 180 },
      { x: 1000, y: 620 },
      { x: 120, y: 570 },
    ];
    const rand = mulberry32(20260921);
    const noise = () => {
      const g = gaussian(rand);
      return Math.max(-3, Math.min(3, g * 0.75)); // gaussiano σ=0.75 recortado a ±3px
    };
    const edgePoints = (p: Corner, q: Corner): Corner[] => {
      const n = Math.max(1, Math.floor(Math.hypot(q.x - p.x, q.y - p.y) / 4));
      const pts: Corner[] = [];
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        pts.push({ x: p.x + (q.x - p.x) * t + noise(), y: p.y + (q.y - p.y) * t + noise() });
      }
      return pts;
    };
    const lines = [
      fitLineTrimmed(edgePoints(gt[0], gt[1])),
      fitLineTrimmed(edgePoints(gt[1], gt[2])),
      fitLineTrimmed(edgePoints(gt[2], gt[3])),
      fitLineTrimmed(edgePoints(gt[3], gt[0])),
    ];
    const res = refineQuadFromLines(lines[0], lines[1], lines[2], lines[3], gt);
    expect(res.fellBack).toEqual([false, false, false, false]);
    const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y);
    for (let i = 0; i < 4; i++) {
      expect(dist(res.quad[i], gt[i])).toBeLessThanOrEqual(0.5);
    }
  });

  it('un lado sin puntos → fallback SOLO en ese lado + flag', () => {
    const gt: Quadrilateral = [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 600 },
      { x: 100, y: 600 },
    ];
    // Lado top sin puntos válidos: recta degenerada → TL (3+0) y TR (0+1) null.
    const topDegenerate: LineEq = { a: 0, b: 0, c: 0 };
    const right = lineFromPoints(gt[1], gt[2]);
    const bottom = lineFromPoints(gt[2], gt[3]);
    const left = lineFromPoints(gt[3], gt[0]);

    const res = refineQuadFromLines(topDegenerate, right, bottom, left, gt);
    expect(res.fellBack).toEqual([true, false, false, false]);
    expect(res.quad[0]).toEqual({ x: 100, y: 100 }); // TL 480p
    expect(res.quad[1]).toEqual({ x: 900, y: 100 }); // TR 480p
    expect(res.quad[2]).toEqual({ x: 900, y: 600 }); // BR refinada intacta
    expect(res.quad[3]).toEqual({ x: 100, y: 600 }); // BL refinada intacta
  });

  it('validación global falla con todas las esquinas → fallback de los 4 lados', () => {
    const fb: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    // Las 4 rectas son las 2 diagonales → las 4 intersecciones colapsan en (50,50):
    // área 0 → la validación global falla con todas las esquinas presentes.
    const diagA = lineFromPoints({ x: 0, y: 0 }, { x: 100, y: 100 });
    const diagB = lineFromPoints({ x: 100, y: 0 }, { x: 0, y: 100 });
    const res = refineQuadFromLines(diagA, diagB, diagA, diagB, fb);
    expect(res.fellBack).toEqual([true, true, true, true]);
    expect(res.quad).toEqual(fb);
  });

  it('esquina null AISLADA (solo TL) → fallback de sus 2 lados adyacentes (3 y 0)', () => {
    const fb: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    // TL = leftL × topL casi paralelas → |den| < 1e-12 → TL null.
    // Top ∦ right, right ∦ bottom, bottom ∦ left → TR, BR y BL vivos.
    const top: LineEq = { a: 0, b: 1, c: 0 }; // y = 0
    const left: LineEq = { a: 1e-13, b: -1, c: 0 }; // y ≈ 0 (∥ top)
    const right: LineEq = { a: 1, b: 0, c: -100 }; // x = 100
    const bottom: LineEq = { a: 1, b: 1, c: -200 }; // x + y = 200
    const res = refineQuadFromLines(top, right, bottom, left, fb);
    expect(res.fellBack).toEqual([true, false, false, true]);
    expect(res.quad).toEqual(fb); // TL, TR, BL caen a 480p; BR queda refinado (= (100,100))
  });
});

describe('7. validateQuad — validación estricta §5-F1', () => {
  it('mariposa (auto-intersección) → false', () => {
    const butterfly: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(hasSelfIntersection(butterfly)).toBe(true);
    expect(validateQuad(butterfly, 100, 100)).toBe(false);
  });
  it('no convexo (dardo) → false', () => {
    const concave: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 2 },
      { x: 0, y: 10 },
    ];
    expect(isConvex(concave)).toBe(false);
    expect(validateQuad(concave, 100, 100)).toBe(false);
  });
  it('área 10% del frame → false (mínimo 25%)', () => {
    const small: Quadrilateral = [
      { x: 0, y: 0 },
      { x: 316, y: 0 },
      { x: 316, y: 316 },
      { x: 0, y: 316 },
    ];
    // 316² ≈ 100.000 px² ≈ 10% del frame 1000×1000 (por debajo del mínimo 25%).
    expect(quadArea(small)).toBeGreaterThan(90_000);
    expect(quadArea(small)).toBeLessThan(110_000);
    expect(sideRatios(small)[0]).toBe(1);
    expect(validateQuad(small, 1000, 1000)).toBe(false);
  });
  it('cuadrado 1:1 dentro del frame → true', () => {
    const ok: Quadrilateral = [
      { x: 100, y: 100 },
      { x: 900, y: 100 },
      { x: 900, y: 900 },
      { x: 100, y: 900 },
    ];
    expect(validateQuad(ok, 1000, 1000)).toBe(true);
  });
});