// src/export/pdfExport.ts — densidad del PDF multipágina (§5-F5). PURO en la
// parte que importa (pdf-lib funciona en Node: empaqueta páginas ENCODE de la
// cola sin tocar canvas ni IndexedDB — solo Blob → bytes). Letter default
// [612,792]pt (formato D1 del plan), A4 opcional [595.28,841.89]pt. El meta
// <8MB lo reporta PageGallery (PDF_SIZE_LIMIT_BYTES) — aquí solo se produce.

import { PDFDocument } from 'pdf-lib';
import type { PageRecord } from './pageStore';

/** Página Letter en pt (D1 del plan; formato por defecto del export F5). */
export const LETTER_PT: readonly [number, number] = [612, 792];

/** Página A4 en pt (opción del export F5 — paper A4 de la spec, no invento). */
export const A4_PT: readonly [number, number] = [595.28, 841.89];

/** Empaqueta las páginas en un PDF de una página por folio (imagen encajada
 *  en el folio con márgenes, proporción preservada). No genera metadatos
 *  protegidos; las imágenes se insertan tal cual (blobs ya ENCODE en la cola). */
export async function fromPages(
  pages: PageRecord[],
  opts: { a4?: boolean } = {},
): Promise<Blob> {
  return new Blob([new Uint8Array(await pdfBytes(pages, opts))], { type: 'application/pdf' });
}

/** Bytes del PDF generado (núcleo Node-testeable sin Blob si hiciera falta —
 *  probar embed + conteo de folios con PDFDocument.load). */
export async function pdfBytes(
  pages: PageRecord[],
  opts: { a4?: boolean } = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [pw, ph] = opts.a4 ? A4_PT : LETTER_PT;
  const availW = pw;
  const availH = ph;

  for (const p of [...pages].sort((a, b) => a.order - b.order)) {
    const bytes = new Uint8Array(await p.blob.arrayBuffer());
    const img =
      p.blob.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const scale = Math.min(availW / img.width, availH / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const page = doc.addPage([pw, ph]);
    page.drawImage(img, {
      x: (pw - w) / 2,
      y: (ph - h) / 2,
      width: w,
      height: h,
    });
  }
  return new Uint8Array(await doc.save());
}