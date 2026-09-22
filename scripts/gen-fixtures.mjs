// scripts/gen-fixtures.mjs — fixtures sintéticos F1 con ground truth (Fase 0).
// Sin dependencias: rasterizador propio + writer PNG mínimo (zlib de Node +
// CRC32 manual). Determinista (PRNG con semilla). Escenas 360×640 (9:16
// portrait, como el track real) con GT = esquinas del papel en fracciones.
// Uso: node scripts/gen-fixtures.mjs → tests/fixtures/f1-{a..f}.png + gt.json
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 360;
const H = 640;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures');

// --- PRNG determinista (mulberry32) ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Framebuffer RGB ---
function frame(r, g, b) {
  return { w: W, h: H, data: Buffer.alloc(W * H * 3, 0).fill(0).map(() => 0), r, g, b };
}

function fillNoise(fb, base, amp, rnd) {
  const { data } = fb;
  for (let i = 0; i < W * H; i++) {
    const n = Math.floor((rnd() * 2 - 1) * amp);
    data[i * 3] = Math.max(0, Math.min(255, base[0] + n));
    data[i * 3 + 1] = Math.max(0, Math.min(255, base[1] + n));
    data[i * 3 + 2] = Math.max(0, Math.min(255, base[2] + n));
  }
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function drawPaper(fb, poly, shade) {
  const { data } = fb;
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPoly(x + 0.5, y + 0.5, poly)) {
        const i = (y * W + x) * 3;
        data[i] = shade;
        data[i + 1] = shade;
        data[i + 2] = shade;
      }
    }
  }
}

/** Rect centrado (w×h) rotado `deg` alrededor del centro. */
function rotatedRect(cx, cy, w, h, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}

// --- PNG mínimo (truecolor 8-bit) ---
function crc32Table() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC_T = crc32Table();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function writePNG(fb, path) {
  const raw = Buffer.alloc((1 + W * 3) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filtro None
    fb.data.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// --- Escenas ---
const CX = W / 2;
const CY = H / 2;
const PW = 280; // carta 8.5/11 en 360×640
const PH = Math.round(PW / (8.5 / 11)); // ≈362

const scenes = [
  {
    id: 'a',
    desc: 'papel sobre fondo oscuro',
    bg: [42, 46, 58],
    paper: rotatedRect(CX, CY, PW, PH, 4),
    expect: 'quad',
  },
  {
    id: 'b',
    desc: 'papel sobre fondo CLARO (bajo contraste)',
    bg: [198, 200, 205],
    paper: rotatedRect(CX, CY, PW, PH, -3),
    expect: 'quad',
  },
  {
    id: 'c',
    desc: 'rotado ~10°',
    bg: [42, 46, 58],
    paper: rotatedRect(CX, CY, PW, PH, 10),
    expect: 'quad',
  },
  {
    id: 'd',
    desc: 'perspectiva leve (trapecio)',
    bg: [42, 46, 58],
    paper: [
      [CX - 118, CY - 190],
      [CX + 118, CY - 190],
      [CX + 140, CY + 190],
      [CX - 140, CY + 190],
    ],
    expect: 'quad',
  },
  {
    id: 'e',
    desc: 'parcialmente fuera del frame (25% fuera der.)',
    bg: [42, 46, 58],
    paper: rotatedRect(CX + 120, CY, PW, PH, 2),
    expect: 'partial',
  },
  {
    id: 'f',
    desc: 'sin papel (distractores <25% área)',
    bg: [42, 46, 58],
    paper: null,
    distractors: [
      [
        [40, 80],
        [140, 80],
        [140, 160],
        [40, 160],
      ],
      [
        [220, 400],
        [300, 400],
        [300, 470],
        [220, 470],
      ],
    ],
    expect: 'null',
  },
];

mkdirSync(OUT, { recursive: true });
const gt = {};
for (const sc of scenes) {
  const rnd = mulberry32(1000 + sc.id.charCodeAt(0));
  const fb = frame();
  fillNoise(fb, sc.bg, 8, rnd);
  if (sc.paper) drawPaper(fb, sc.paper, 242);
  for (const d of sc.distractors ?? []) drawPaper(fb, d, 150);
  writePNG(fb, join(OUT, `f1-${sc.id}.png`));
  gt[sc.id] = {
    desc: sc.desc,
    expect: sc.expect,
    corners: sc.paper
      ? sc.paper.map(([x, y]) => [+(x / W).toFixed(5), +(y / H).toFixed(5)])
      : null,
  };
  console.log(`f1-${sc.id}.png: ${sc.desc} (expect=${sc.expect})`);
}
writeFileSync(join(OUT, 'gt.json'), JSON.stringify({ w: W, h: H, scenes: gt }, null, 2));
console.log('gt.json escrito');
