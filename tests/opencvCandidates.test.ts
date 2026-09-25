// Tests F6 — cadena de candidatos de opencv.js (protocol.ts).
// El SPOF era docs.opencv.org (Cloudflare 403 a datacenters, hallazgo
// F4-fix-arranque): el vendor self-hosted SIEMPRE va primero, el CDN al final.
import { describe, expect, it } from 'vitest';
import { OPENCV_CDN_URL, OPENCV_VENDOR_FILENAME, opencvCandidateUrls } from '../src/workers/protocol';

const VENDOR = `vendor/${OPENCV_VENDOR_FILENAME}`;

describe('opencvCandidateUrls — orden y layouts', () => {
  it('Pages (fN/assets/worker.js): ../../vendor primero, CDN al final', () => {
    const urls = opencvCandidateUrls('https://jg-stevan.github.io/mobile-scanner/f4/assets/detection.worker-DU2EpkNr.js');
    expect(urls[0]).toBe(`https://jg-stevan.github.io/mobile-scanner/${VENDOR}`);
    expect(urls[1]).toBe(`https://jg-stevan.github.io/mobile-scanner/f4/${VENDOR}`);
    expect(urls[urls.length - 1]).toBe(OPENCV_CDN_URL);
    expect(urls).toHaveLength(3);
  });

  it('Dev Vite (/src/workers/detection.worker.ts): /vendor (public/) primero', () => {
    const urls = opencvCandidateUrls('http://localhost:5199/src/workers/detection.worker.ts');
    expect(urls[0]).toBe(`http://localhost:5199/${VENDOR}`);
    expect(urls[1]).toBe(`http://localhost:5199/src/${VENDOR}`);
    expect(urls[urls.length - 1]).toBe(OPENCV_CDN_URL);
  });

  it('Worker plano a un nivel (/assets/worker.js): ../../ = raíz, ../ = hermana', () => {
    const urls = opencvCandidateUrls('https://ejemplo.org/app/assets/detection.worker-x.js');
    expect(urls[0]).toBe(`https://ejemplo.org/${VENDOR}`);
    expect(urls[1]).toBe(`https://ejemplo.org/app/${VENDOR}`);
  });

  it('Sin duplicados aunque los candidatos colisionen', () => {
    const urls = opencvCandidateUrls('https://x.org/vendor/detection.worker.js');
    const set = new Set(urls);
    expect(set.size).toBe(urls.length);
  });

  it('El CDN es SIEMPRE el último recurso y el vendor SIEMPRE el primero', () => {
    for (const w of [
      'https://jg-stevan.github.io/mobile-scanner/f5/assets/detection.worker-abc.js',
      'http://localhost:5199/src/workers/detection.worker.ts',
      'file:///x/y/worker.js',
    ]) {
      const urls = opencvCandidateUrls(w);
      expect(urls[0]).toContain(VENDOR);
      expect(urls[urls.length - 1]).toBe('https://docs.opencv.org/4.5.5/opencv.js');
    }
  });
});
