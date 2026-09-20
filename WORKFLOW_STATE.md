# WORKFLOW_STATE — mobile-scanner

Última actualización: 2026-09-19

## Tareas Completadas
- **Adaptación del entorno** (PLAN_ADAPTACION Fases 0-5): 8 agentes globales, AGENTS.md,
  WORKFLOW_STATE.md, 3 skills de dominio, comando `/spike` + `/ship`, HTML del spike F0.
  Evidencias en `PLAN_EVIDENCE/adaptacion/`.

## Tareas en Progreso
- _F0 spike: instrumento HTML generado, pendiente ejecución HUMANA en 2-3 dispositivos reales (incl. iPhone físico)._

## Verificaciones pendientes (TUI/humanas)
- T0.5 `opencode agent list` → 8 agentes desde mobile-scanner — **HECHO** (verificado 2026-09-20; evidencia 00 actualizada)
- T1.4 `@explorador` cap ~3500px AGENTS.md:21 — **HECHO** (2026-09-20)
- T2.4 skill `opencv-wasm-memoria` (withMats) con `@implementador-backend` — **HECHO** (2026-09-20)
- T4.3 fallback revisor → revisor-fallback: **HECHO** (2026-09-20; cazó y corrigió ratio 16:9 implícito en spike.html)
- T4.1 `opencode mcp list` → 4/4 desde mobile-scanner — ⏳ **última pendiente** (CLI cuelga; visual TUI)

## Decisiones de Arquitectura
- **Fuente:** PLAN_MAESTRO v3.0 congelado · Fase actual: F0 spike pendiente
- **Entorno adaptado y verificado** (automatizable + TUI de cierre). Único pendiente del plan de
  adaptación: T4.1 `opencode mcp list` en TUI.
- **Fix 2026-09-20 (T4.3):** `spike.html` constraints ahora piden solo presupuesto de píxeles sin ratio;
  aviso de cap >3500px añadido al log. Re-validado sin errores.
- Los agentes NO re-discuten decisiones del maestro; proponen por escrito, nunca inline (ver AGENTS.md).