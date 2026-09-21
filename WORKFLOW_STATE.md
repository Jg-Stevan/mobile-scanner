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

- **T1-R2 implementada (2026-09-21 · pendiente /ship doble revisor):** spike.html — fix
  quad native2disp (drawQuad/hitTest multiplican fracción × nativo; guard `!nw||!nh`),
  leak getUserMedia en refreshDevices (tracks detenidos), CSS `#torchBtn.torch-ok`.
  20/20 tests, tsc limpio, verificación Playwright: esquinas spread (362,590)–(931,1134),
  pre-fix colapsaban a (1,378); drag con 0 px error nativo. Evidencia en
  `PLAN_EVIDENCE/T1-R2/` (screenshot + assertions.json).

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

## Desviaciones Documentadas
- **D1 (aceptada por humano · 2026-09-21 · tarea T1):** formato de referencia A4 → CARTA (8.5 × 11 in). Motivo: estándar regional + disponibilidad real de papel carta en el entorno de medición. A4 queda como alternativa documentada.