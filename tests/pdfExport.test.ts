// tests/pdfExport.test.ts — densidad del PDF multipágina (§5-F5). pdf-lib
// funciona en Node: folios, orden, Letter/A4 y mime verificados desde el PDF.
// Sin DOM: los blobs de prueba son PNG sintéticos VÁLIDOS construidos a mano
// (CRC32 + DEFLATE en bloques "stored", sin zlib ni @types/node). La rama JPEG
// (embedJpg) se cubre en el E2E del harness F5 con blobs REALES de
// OffscreenCanvas.convertToBlob — aquí solo PNG (mismo camino de pdf-lib; el
// ternario mime es de bajo riesgo).

import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { A4_PT, LETTER_PT, fromPages, pdfBytes } from '../src/export/pdfExport';
import type { PageRecord } from '../src/export/pageStore';

/** CRC32 (IEEE) del PNG (polinomio internacional estándar). */
function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32 (RFC 1950) — suma de verificación zlib. */
function adler32(buf: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]!) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/**
 * Stream ZLIB (RFC 1950) en bloques DEFLATE "stored" (BTYPE=00, sin
 * comprimir — válido por spec): cabecera 0x78 0x01 + bloques + adler32.
 * pdf-lib's UPNG espera exactamente este formato (salta 2 bytes de cabecera
 * y 4 de adler al inflar). Cualquier tamaño; bloques de 65535 bytes.
 */
function zlibStored(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array<ArrayBuffer>[] = [new Uint8Array([0x78, 0x01])];
  const MAX = 65535;
  for (let off = 0; off < data.length; off += MAX) {
    const n = Math.min(MAX, data.length - off);
    const len = new Uint8Array(new ArrayBuffer(2));
    const v = new DataView(len.buffer);
    v.setUint16(0, n, true);
    const nlen = new Uint8Array(new ArrayBuffer(2));
    new DataView(nlen.buffer).setUint16(0, ~n & 0xffff, true);
    const final = off + n >= data.length ? 0x01 : 0x00;
    chunks.push(new Uint8Array([final]), len, nlen, data.slice(off, off + n));
  }
  const tail = new Uint8Array(new ArrayBuffer(4));
  new DataView(tail.buffer).setUint32(0, adler32(data), false);
  chunks.push(tail);
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(new ArrayBuffer(total));
  let p = 0;
  for (const c of chunks) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

/** PNG válido de w×h (color tipo 2 RGB, 8 bits, fondo gris 190). */
function png(w: number, h: number): Uint8Array<ArrayBuffer> {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const ihdr = new Uint8Array(new ArrayBuffer(13));
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const scan = new Uint8Array(new ArrayBuffer(h * (1 + w * 3)));
  for (let y = 0; y < h; y++) {
    scan[y * (1 + w * 3)] = 0; // filter none
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3;
      scan[o] = 190;
      scan[o + 1] = 190;
      scan[o + 2] = 190;
    }
  }
  const idat = zlibStored(scan);
  const chunk = (type: string, data: Uint8Array): Uint8Array<ArrayBuffer> => {
    const t = new TextEncoder().encode(type);
    const out = new Uint8Array(new ArrayBuffer(12 + data.length));
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(t, 4);
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(new Uint8Array([...t, ...data])));
    return out;
  };
  const concat = (parts: Uint8Array<ArrayBuffer>[]): Uint8Array<ArrayBuffer> => {
    const out = new Uint8Array(new ArrayBuffer(parts.reduce((s, c) => s + c.length, 0)));
    let p = 0;
    for (const c of parts) {
      out.set(c, p);
      p += c.length;
    }
    return out;
  };
  return concat([
    new Uint8Array(sig),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(new ArrayBuffer(0))),
  ]);
}

function jpeg(): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array.from(
    atob(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==',
    ),
    (c) => c.charCodeAt(0),
  );
  return bytes;
}

function page(id: string, order: number, blob: Blob): PageRecord {
  return { id, blob, mode: id === 'b' ? 'text' : 'color', order, ts: order };
}

describe('pdfBytes (núcleo pdf-lib, blobs PNG reales)', () => {
  it('una página por folio, respetando page.order', async () => {
    // pages desordenadas aposta: order b < a < c.
    const bytes = await pdfBytes([
      page('a', 1, new Blob([png(8, 8)], { type: 'image/png' })),
      page('b', 0, new Blob([png(4, 4)], { type: 'image/png' })),
      page('c', 2, new Blob([png(16, 16)], { type: 'image/png' })),
    ]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
  });

  it('Letter por defecto y A4 opcional (§F5)', async () => {
    const one = new Blob([png(8, 8)], { type: 'image/png' });
    const letters = await pdfBytes([page('a', 0, one)]);
    const letterDoc = await PDFDocument.load(letters);
    const { width: w1, height: h1 } = letterDoc.getPage(0).getSize();
    expect([w1, h1]).toEqual([...LETTER_PT]);

    const a4s = await pdfBytes([page('a', 0, one)], { a4: true });
    const a4Doc = await PDFDocument.load(a4s);
    const { width: w2, height: h2 } = a4Doc.getPage(0).getSize();
    expect([w2, h2]).toEqual([...A4_PT]);
  });

  it('meme de N páginas crece con páginas (5 folios < 8MB meta del plan)', async () => {
    const recs = Array.from({ length: 5 }, (_, i) =>
      page(`p${i}`, i, new Blob([png(64, 64)], { type: 'image/png' })),
    );
    const bytes = await pdfBytes(recs);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(5);
    expect(bytes.length).toBeLessThan(8 * 1024 * 1024);
  });

  it('usa embedJpg para JPEG y embedPng para PNG', async () => {
    const pngBlob = page('p', 0, new Blob([png(4, 4)], { type: 'image/png' }));
    const jpgBlob = page('j', 1, new Blob([jpeg()], { type: 'image/jpeg' }));
    expect((await PDFDocument.load(await pdfBytes([pngBlob, jpgBlob]))).getPageCount()).toBe(2);
  });
});

describe('fromPages', () => {
  it('devuelve un Blob application/pdf', async () => {
    const blob = await fromPages([page('a', 0, new Blob([png(8, 8)], { type: 'image/png' }))]);
    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });
});