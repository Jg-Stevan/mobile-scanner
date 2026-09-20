# WORKFLOW_STATE — mobile-scanner

Última actualización: 2026-09-19

## Tareas Completadas
- **Adaptación del entorno** (PLAN_ADAPTACION Fases 0-5): 8 agentes globales, AGENTS.md,
  WORKFLOW_STATE.md, 3 skills de dominio, comando `/spike` + `/ship`, HTML del spike F0.
  Evidencias en `PLAN_EVIDENCE/adaptacion/`.

## Tareas en Progreso
- _F0 spike: instrumento HTML generado, pendiente ejecución HUMANA en 2-3 dispositivos reales (incl. iPhone físico)._

## Verificaciones pendientes (TUI/humanas)
- T0.5 `opencode agent list` → 8 agentes desde mobile-scanner
- T1.4 `@explorador` "cap de resolución" → ~3500px citando AGENTS.md
- T2.4 skill `opencv-wasm-memoria` disparada por `@implementador-backend`
- T4.1 `opencode mcp list` → 4/4 desde mobile-scanner
- T4.3 fallback espejo (simular fallo)

## Decisiones de Arquitectura
- **Fuente:** PLAN_MAESTRO v3.0 congelado · Fase actual: F0 spike pendiente
- **Entorno adaptado y verificado** (automatizable). Siguiente: ejecución HUMANA del spike en
  2-3 dispositivos (F0 días 1-2).
- Los agentes NO re-discuten decisiones del maestro; proponen por escrito, nunca inline (ver AGENTS.md).