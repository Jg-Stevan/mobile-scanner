#!/usr/bin/env node
// Build del harness F4 → f4/ (F6: script PERSISTENTE, antes era ad-hoc).
// Reproduce el procedimiento de rondas anteriores: root=harnesses, base='./',
// entrada única test-harness-f4device.html, SALIDA acumulativa (los bundles
// viejos en f4/assets/ SE CONSERVAN — regla de higiene de generaciones).
// Uso: node scripts/build-harness-f4.mjs
import { build } from 'vite';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '..');
const tmp = await mkdtemp(join(tmpdir(), 'f4-harness-'));

try {
  await build({
    root: join(repo, 'harnesses'),
    base: './',
    logLevel: 'error',
    build: {
      outDir: tmp,
      emptyOutDir: true,
      rollupOptions: { input: join(repo, 'harnesses', 'test-harness-f4device.html') },
    },
  });
  // html + assets nuevos ENCIMA de los existentes (sin borrar generaciones)
  await cp(join(tmp, 'test-harness-f4device.html'), join(repo, 'f4', 'test-harness-f4device.html'));
  await cp(join(tmp, 'assets'), join(repo, 'f4', 'assets'), { recursive: true });
  console.log('✅ f4/ actualizado (generaciones previas conservadas)');
} finally {
  await rm(tmp, { recursive: true, force: true });
}
