# WORKFLOW_STATE — mobile-scanner

Última actualización: 2026-09-21

## Tareas Completadas
- **Adaptación del entorno** (PLAN_ADAPTACION Fases 0-5): 8 agentes globales, AGENTS.md,
  WORKFLOW_STATE.md, 3 skills de dominio, comando `/spike` + `/ship`, HTML del spike F0.
  Evidencias en `PLAN_EVIDENCE/adaptacion/`.
- **T1-carta cerrada (2026-09-21 · /ship doble APROBADO):** spike.html (constante
  PAPER_DEFAULT_IN + 6 ediciones) + PLAN_MAESTRO §4/F3/F4/F5 en carta + coherencia
  skills/comando `/spike` a v3.1. Evidencia en `PLAN_EVIDENCE/2026-09-21-T1-carta/`
  (screenshot Playwright panel DPI 8.5 + diff + sanity 844.8px/99.4 DPI).
- **T2-core cerrado (2026-09-21 · /ship doble APROBADO):** scaffolding Vite+TS strict+Vitest
  (§8) + types.ts (PAPER_SIZES_IN, default carta D1, dpiRuntime opcional) +
  geometry.ts (8 funciones + 6 constantes exactas, gate aspect ratios F3 blindado) +
  20/20 tests verdes, cobertura geometry.ts 94.69% líneas, tsc limpio.
  Evidencia en `PLAN_EVIDENCE/2026-09-21-T2-core/`.
- **T1-R2 cerrada (2026-09-21 · /ship doble APROBADO):** spike.html — fix
  quad native2disp (drawQuad/hitTest multiplican fracción × nativo; guard `!nw||!nh`),
  leak getUserMedia en refreshDevices (tracks detenidos), CSS `#torchBtn.torch-ok`.
  20/20 tests, tsc limpio, verificación Playwright local + deploy: esquinas spread,
  pre-fix colapsaban; drag 0 px error. Evidencia en `PLAN_EVIDENCE/T1-R2/`.
- **T1-R3 cerrada (2026-09-21):** Deploy a GitHub Pages + verificación HTTPS pública.
  URL: https://jg-stevan.github.io/mobile-scanner/spike.html
  - Spike funcional: cámara fake activa (640×480), panel DPI carta 8.5, quad 6122 px verdes (no colapsado).
  - Commit cfa60e1 + push + Pages activo (main/root). Evidencia en `PLAN_EVIDENCE/T1-R3/`.
- **T1-R4 cerrada (2026-09-21 · /ship doble APROBADO):** hallazgos del spike
  Android registrados (D2 orientación/DPI, D3 focusMode, D4 ruta C ignora
  deviceId, corrección takePhoto natural ≈220-240 DPI) en WORKFLOW_STATE +
  PLAN_MAESTRO §4 (nota bajo tabla intacta) y §8 (focusMode D3) + fix spike.html
  (fromEntries con pares [k,v], texto ℹ cap 3500px de salida). Verificado en
  cámara fake 640×480: capabilities raw poblado (pre-fix `{}`). Evidencia en
  `PLAN_EVIDENCE/T1-R4/` (screenshot + cameraProfileLog + diff).
- **T3-quality cerrado (2026-09-21 · /ship doble APROBADO):** src/core/quality.ts
  puro (11 constantes con origen, 7 funciones §5-F2, excentricidad CANDIDATE
  bloqueada con throw — ECCENTRICITY_MARGIN=0.05 pendiente de aprobación
  humana) + 21 tests nuevos (backpressure por timestamps, racha de shutter,
  renormalización exacta). 40/40 tests, quality.ts 100% líneas, tsc limpio.
  Evidencia en `PLAN_EVIDENCE/T3-quality/`.
- **T3-b cerrada (2026-09-21 · /ship doble APROBADO):** excentricidad aprobada
  implementada (computeEccentricityScore: margin 5% lado corto, peor domina;
  total = base × ecc, shutter la hereda). 48/48 tests, quality.ts 100% líneas,
  tsc limpio. Evidencia en `PLAN_EVIDENCE/T3-b-eccentricity/`.
## Tareas en Progreso
- _F0 spike: instrumento HTML generado, pendiente ejecución HUMANA en 2-3 dispositivos reales (incl. iPhone físico)._

## Verificaciones pendientes (TUI/humanas)
- T0.5 `opencode agent list` → 8 agentes desde mobile-scanner — **HECHO** (verificado 2026-09-20; evidencia 00 actualizada)
- T1.4 `@explorador` cap ~3500px AGENTS.md:21 — **HECHO** (2026-09-20)
- T2.4 skill `opencv-wasm-memoria` (withMats) con `@implementador-backend` — **HECHO** (2026-09-20)
- T4.3 fallback revisor → revisor-fallback: **HECHO** (2026-09-20; cazó y corrigió ratio 16:9 implícito en spike.html)
- T4.1 `opencode mcp list` → 4/4 desde mobile-scanner — ⏳ **última pendiente** (CLI cuelga; visual TUI)

## Decisiones de Arquitectura
- **Fuente:** PLAN_MAESTRO v3.1 congelado · Fase actual: T2 núcleo matemático (F0 spike pendiente de ejecución humana)
- **Entorno adaptado y verificado** (automatizable + TUI de cierre). Único pendiente del plan de
  adaptación: T4.1 `opencode mcp list` en TUI.
- **Fix 2026-09-20 (T4.3):** `spike.html` constraints ahora piden solo presupuesto de píxeles sin ratio;
  aviso de cap >3500px añadido al log. Re-validado sin errores.
- Los agentes NO re-discuten decisiones del maestro; proponen por escrito, nunca inline (ver AGENTS.md).
- **Aprobación humana 2026-09-21 (excentricidad):** ECCENTRICITY_MARGIN = 0.05
  del lado corto; score = mín de clamp(dMin/margin, 0, 1) por esquina;
  integración MULTIPLICATIVA (total = base × ecc) — la fórmula §5-F2 queda
  intacta. Adjudicación: la renormalización genérica Σ(w·v)/Σ(w) de T3 rige
  sobre el "(0.4/0.7…)" ambiguo del brief (sumaría >1).

## Desviaciones Documentadas
- **D1 (aceptada por humano · 2026-09-21 · tarea T1):** formato de referencia A4 → CARTA (8.5 × 11 in). Motivo: estándar regional + disponibilidad real de papel carta en el entorno de medición. A4 queda como alternativa documentada.
- **D2 (registrada · T1-R4 · spike Android SM-A566E):** la orientación del teléfono afecta el DPI en documentos portrait: vertical ≈ 254 DPI teórico vs horizontal ≈ 196 (el lado corto del sensor alinea con el lado largo del papel). Acción futura: guía de orientación en UI (F1/F2).
- **D3 (registrada · T1-R4 · spike Android):** criterio de selección de cámara = `focusMode` con "continuous"/"single-shot" (autofocus real). Cámaras solo-[manual] = fixed-focus → descartadas. Validado: cámara 2 (ultra-wide) sin AF y sin torch → descartada.
- **D4 (registrada · T1-R4 · spike Android):** la ruta C (`input capture`) ignora el `deviceId` seleccionado; siempre usa la principal de la app nativa (validado: 6120×8160 con ambas cámaras).
- **Corrección de expectativa §4 (registrada · T1-R4 · spike Android SM-A566E):** `takePhoto` Android con encuadre natural (preview 9:16, el papel no llena la foto 3:4) ≈ **220-240 DPI**, no ~353. El teórico 353 asumía el papel llenando la foto — condición no alcanzable desde el preview. Validado: video 225 DPI (88.6% encuadre).