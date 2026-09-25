#!/usr/bin/env node
// Análisis del manifest.jsonl del colector F4 (ronda 1 de validación humana).
// Valida cada línea contra el contrato DatasetEntry (src/core/dataCollect.ts)
// y produce estadísticas para la evidencia de F4.
// Uso: node scripts/analyze-manifest-r1.mjs [ruta-manifest.jsonl]

import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'PLAN_EVIDENCE/F4/colector/manifest-ronda1.jsonl';
const raw = readFileSync(path, 'utf8');
const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

const CONDICIONES = new Set(['normal', 'poca-luz', 'fondo-claro', 'inclinado', 'sombra']);
const ROUTES = new Set(['A', 'B', 'burst']);
const errors = [];
const recs = [];

lines.forEach((line, i) => {
  const n = i + 1;
  let r;
  try { r = JSON.parse(line); } catch (e) { errors.push(`L${n}: JSON inválido (${e.message})`); return; }
  const label = `L${n} ${String(r.id ?? '?').slice(0, 8)}`;

  // — Contrato DatasetEntry —
  const req = ['id', 'ts', 'route', 'revalScore', 'autoQuad', 'fellBack', 'device', 'condicion'];
  for (const k of req) if (!(k in r)) errors.push(`${label}: falta campo '${k}'`);
  if (typeof r.ts !== 'number' || !(r.ts >= 0)) errors.push(`${label}: ts no numérico`);
  if (!ROUTES.has(r.route)) errors.push(`${label}: route '${r.route}' fuera de A|B|burst`);
  if (typeof r.revalScore !== 'number' || !Number.isFinite(r.revalScore)) errors.push(`${label}: revalScore no finito`);
  if (!CONDICIONES.has(r.condicion)) errors.push(`${label}: condicion '${r.condicion}' no es tag válido`);

  // autoQuad: null | 8 floats en [0,1]
  if (r.autoQuad !== null) {
    if (!Array.isArray(r.autoQuad) || r.autoQuad.length !== 8) {
      errors.push(`${label}: autoQuad debe ser null | array de 8`);
    } else if (r.autoQuad.some((v) => typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1)) {
      errors.push(`${label}: autoQuad con valores fuera de [0,1]`);
    } else {
      // Sanidad geométrica: par superior (y1,y3,y5,y7 índices 1,3) vs inferior (5,7)
      const yTop = (r.autoQuad[1] + r.autoQuad[3]) / 2;
      const yBot = (r.autoQuad[5] + r.autoQuad[7]) / 2;
      if (!(yTop < yBot)) errors.push(`${label}: winding sospechoso (yTop ${yTop.toFixed(2)} >= yBot ${yBot.toFixed(2)})`);
    }
  }

  // fellBack: null | 4 booleanos — INVARIANTE: si autoQuad es null no hubo
  // refine → fellBack debe ser null ("null si no hubo refine", dataCollect.ts)
  const fb4 = Array.isArray(r.fellBack) && r.fellBack.length === 4 && r.fellBack.every((b) => typeof b === 'boolean');
  if (!fb4 && r.fellBack !== null) errors.push(`${label}: fellBack debe ser null | 4 booleanos`);
  if (r.autoQuad === null && r.fellBack !== null) {
    errors.push(`${label}: INVARIANTE ROTO — autoQuad null pero fellBack NO null (meta stale de captura previa)`);
  }

  // adjustedQuad (opcional): 8 floats en [0,1]
  if ('adjustedQuad' in r) {
    const ok = Array.isArray(r.adjustedQuad) && r.adjustedQuad.length === 8 &&
      r.adjustedQuad.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
    if (!ok) errors.push(`${label}: adjustedQuad mal formado`);
  }

  if (r.device && (typeof r.device.trackW !== 'number' || typeof r.device.trackH !== 'number')) {
    errors.push(`${label}: device.trackW/H no numéricos`);
  }
  recs.push(r);
});

// — Estadísticas —
const byCond = {};
for (const r of recs) byCond[r.condicion] = (byCond[r.condicion] ?? 0) + 1;
const byRoute = {};
for (const r of recs) byRoute[r.route] = (byRoute[r.route] ?? 0) + 1;
const withQuad = recs.filter((r) => r.autoQuad !== null);
const noQuad = recs.filter((r) => r.autoQuad === null);
const adjusted = recs.filter((r) => 'adjustedQuad' in r);
const fbCounts = { '0/4': 0, '1/4': 0, '2/4': 0, '3/4': 0, '4/4': 0 };
for (const r of withQuad) {
  const n = r.fellBack.filter(Boolean).length;
  fbCounts[`${n}/4`]++;
}
const scores = recs.map((r) => r.revalScore).sort((a, b) => a - b);
const gaps = [];
for (let i = 1; i < recs.length; i++) gaps.push(recs[i].ts - recs[i - 1].ts);
const devices = new Set(recs.map((r) => `${r.device?.platform}/${r.device?.trackW}x${r.device?.trackH}`));
const sessionS = recs.length ? (recs[recs.length - 1].ts - recs[0].ts) / 1000 : 0;

console.log(`Manifest: ${path}`);
console.log(`Registros: ${recs.length} | Errores: ${errors.length}`);
console.log(`Duración de sesión (ts): ~${sessionS.toFixed(1)} s | Gaps entre capturas (s): ${gaps.map((g) => (g / 1000).toFixed(0)).join(', ')}`);
console.log(`Route: ${JSON.stringify(byRoute)} | Device: ${[...devices].join(', ')}`);
console.log(`Condiciones: ${JSON.stringify(byCond)}`);
console.log(`Con autoQuad: ${withQuad.length} | Sin detección (null): ${noQuad.length} | Con adjustedQuad: ${adjusted.length}`);
console.log(`fellBack (refine): ${JSON.stringify(fbCounts)}`);
console.log(`revalScore: min ${scores[0]?.toFixed(0)} | mediana ${scores[Math.floor(scores.length / 2)]?.toFixed(0)} | max ${scores[scores.length - 1]?.toFixed(0)}`);
console.log('');
if (errors.length) {
  console.log('HALLAZGOS:');
  for (const e of errors) console.log(`  ✗ ${e}`);
} else {
  console.log('HALLAZGOS: ninguno — 9/9 cumplen el contrato DatasetEntry');
}
