# 05 — Cierre: verificaciones de herencia/interacción (TUI/CLI)

Fecha: 2026-09-20 · Sesión de cierre del PLAN_ADAPTACION después del reinicio de opencode.

## Resultados de los 5 pendientes

| # | Checkpoint | Resultado | Evidencia |
|---|---|---|---|
| 1 | **T0.5** `opencode agent list` → 8/8 agentes heredados | ✅ **PASA** | `opencode agent list` devuelve explorador, explorador-fallback, implementador-backend, implementador-fallback, orquestador, revisor, revisor-b, revisor-fallback (+built-ins build/compaction/plan/summary/title/explore/general). Visto desde CLI. |
| 2 | **T1.4** `@explorador` "cap de resolución y por qué" | ✅ **PASA** | El agente respondió **~3500px (lado largo)**, justificación de memoria/performance (~A4@300DPI, picos <150MB en móviles 3GB), citando **AGENTS.md línea 21** (sección "Disciplina obligatoria") y PLAN_MAESTRO v3.0. |
| 3 | **T2.4** skill de dominio disparada | ✅ **PASA** | Tarea delegada a `@implementador-backend` ("prepárate para tocar el detection worker"): identificó la skill **`opencv-wasm-memoria`** como la aplicable, declaró **`withMats()` OBLIGATORIO** para todo `cv.Mat`/`MatVector` (`.delete()` garantizado en `finally`), aspect ratios **PROHIBIDOS** (se miden), cap ~3500px. |
| 4 | **T4.3** fallo `@revisor` → re-delegación `@revisor-fallback` | ✅ **PASA + hallazgo real** | Fallback invocado como revisor, emitió veredicto independiente sobre `spike.html`. Veredicto: **NO-GO** con 2 hallazgos válidos → ver abajo. El mecanismo espejo funciona. |
| 5 | **T4.1** `opencode mcp list` → 4/4 | ⏳ TUI humana | `opencode mcp list` sigue **colgando** en modo no-interactivo (kill del proceso). Config global verificada por lectura: 4 MCPs (context7, playwright, sequential-thinking, serena). Queda única verificación pendiente para el humano en TUI. |

## Hallazgo real cazado por el revisor-fallback (T4.3)

El fallback (4.º set de ojos sobre `spike.html`) detectó que el bloque `constraints` seguía pidiendo
`width: {ideal: 3840}, height: {ideal: 2160}` — un **par 16:9 hardcodeado** en forma de ratio implícito
(el mismo problema que la revisión A cazó como `aspectRatio:4/3` explícito). La doble revisión de T3.3
lo había corregido parcialmente; T4.3 demostró que el patrón de revisión espejo sigue siendo útil.

**Fix aplicado (2026-09-20):**
1. `spike.html:202` → `constraints` pide solo presupuesto de píxeles (`width: {ideal: 3840}`), **sin height**:
   el ratio lo resuelve el dispositivo y se mide con `getSettings()` — nunca se solicita (AGENTS.md).
2. `renderProfileLog` → nueva línea de aviso si el track supera el cap (`⚠ cap ~3500px superado…`), para
   que el humano lo anote en los resultados del spike.

**Re-validación:** sintaxis OK (`node --check`, script de 15.5k chars) · runtime servido por HTTP + Playwright:
0 errores JS (único log = favicon 404, cosmético).

## Conclusión

Los criterios 1, 2, 3 y 5 del RESUMEN pasan a **100% ✅**. Único pendiente remanente del plan de adaptación:
T4.1 `mcp list` (verificación visual en TUI) y la **ejecución humana del spike** en 2-3 dispositivos reales.