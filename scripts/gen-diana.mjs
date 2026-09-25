// scripts/gen-diana.mjs — diana imprimible F4 (orden F4, punto 4).
// PNG carta (8.5×11in) con un rectángulo NEGRO de 7.5×10in centrado y una
// muesca blanca de registro en cada esquina. La diana del repo conserva el
// tamaño teórico 7.5×10 pulgadas; para el reporte F4 el humano mide el ancho
// real impreso y dianaMath convierte px→mm usando esa medida.
//
// 300 DPI para que el marcador de resolución (pHYs) lo imprima a tamaño
// físico en la mayoría de impresoras: 8.5in·300 = 2550px, 11in·300 = 3300px;
// rectángulo 7.5in·300 = 2250px, 10in·300 = 3000px (margen 0.5in = 150px).
// Sin dependencias: encodificador PNG mínimo (zlib + CRC32) como
// gen-fixtures.mjs. Uso: node scripts/gen-diana.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DPI = 300;
const IN = 25.4; // mm por pulgada (solo para logs)
const W = Math.round(8.5 * DPI); // 2550
const H = Math.round(11 * DPI); // 3300
const RECT_W = Math.round(7.5 * DPI); // 2250
const RECT_H = Math.round(10 * DPI); // 3000
const MARGIN_X = Math.round((W - RECT_W) / 2); // 150
const MARGIN_Y = Math.round((H - RECT_H) / 2); // 150
const MARK = 30; // muesca de registro en px (0.1in)
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'diana-letter-300dpi.png');

// --- PNG mínimo (truecolor 8-bit) con chunks pHYs (resolución) + IDAT ---
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
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  const phys = Buffer.alloc(9);
  phys.writeUInt32BE(Math.round(DPI / 0.0254), 0); // ppm X = 300 DPI
  phys.writeUInt32BE(Math.round(DPI / 0.0254), 4); // ppm Y
  phys[8] = 1; // metro
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// --- Framebuffer: blanco + rectángulo negro + muescas blancas en esquinas ---
const fb = { data: Buffer.alloc(W * H * 3, 255) };
const setPx = (x, y, v) => {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  fb.data[i] = v;
  fb.data[i + 1] = v;
  fb.data[i + 2] = v;
};
for (let y = MARGIN_Y; y < MARGIN_Y + RECT_H; y++) {
  for (let x = MARGIN_X; x < MARGIN_X + RECT_W; x++) setPx(x, y, 0);
}
// Muesca de registro blanca en cada esquina EXACTA del rectángulo.
const corners = [
  [MARGIN_X, MARGIN_Y],
  [W - MARGIN_X - MARK, MARGIN_Y],
  [MARGIN_X, H - MARGIN_Y - MARK],
  [W - MARGIN_X - MARK, H - MARGIN_Y - MARK],
];
for (const [cx, cy] of corners) {
  for (let dy = 0; dy < MARK; dy++) {
    for (let dx = 0; dx < MARK; dx++) setPx(cx + dx, cy + dy, 255);
  }
}

// --- Auto-chequeo geométrico antes de escribir ---
const assert = (cond, msg) => {
  if (!cond) throw new Error(`gen-diana: ${msg}`);
};
const pxAt = (x, y) => fb.data[(y * W + x) * 3];
assert(pxAt(MARGIN_X + 1, MARGIN_Y + 1) === 255, 'muesca TL blanca (esquina exacta)');
assert(pxAt(MARGIN_X + MARK - 2, MARGIN_Y + MARK - 2) === 255, 'muesca TL blanca (interior)');
assert(pxAt(MARGIN_X + MARK + 2, MARGIN_Y + MARK + 2) === 0, 'negro justo tras la muesca');
assert(pxAt(MARGIN_X + 40, MARGIN_Y + 40) === 0, 'dentro del rectángulo negro');
assert(pxAt(Math.floor(W / 2), Math.floor(H / 2)) === 0, 'centro negro');
assert(pxAt(50, 50) === 255, 'fondo blanco (margen)');
for (const [cx, cy] of corners) {
  assert(pxAt(cx + MARK - 2, cy + MARK - 2) === 255, 'muesca de esquina presente');
}

writePNG(fb, OUT);
console.log(`diana escrita en ${OUT}`);
console.log(
  `Dimensiones: ${W}×${H}px (${(8.5).toFixed(1)}×${(11).toFixed(1)}in @300DPI) · ` +
    `rectángulo negro ${RECT_W}×${RECT_H}px = 7.5×10in (margen 0.5in)`
);
console.log(
  `Imprimir a ESCALA REAL (100%, "actual size", sin ajustar al área de impresión): ` +
    `el rectángulo debe medir ${7.5 * IN}×${10 * IN} mm (±1 mm).`
);
console.log(
  `En el harness: Modo diana ON → medir el ancho real impreso (y alto, para el
  acta), ingresarlo en el campo, capturar la diana N veces (misma postura
  estática); dianaMath reporta "±X mm al 95%" calibrado contra esa medición.`
);