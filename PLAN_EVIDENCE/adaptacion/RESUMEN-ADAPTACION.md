# RESUMEN-ADAPTACION — mobile-scanner

Fecha: 2026-09-19 · Plan: PLAN_ADAPTACION.md · Evidencias: `PLAN_EVIDENCE/adaptacion/`

## Tabla adaptación → estado → evidencia

| Fase | Ítem | Estado | Evidencia |
|---|---|---|---|
| F0 | T0.1 Estructura + PLAN_MAESTRO.md | ✅ | commit `5cec40a` |
| F0 | T0.2 git init + commit inicial | ✅ | `5cec40a` |
| F0 | T0.3 Promover 8 agentes a global | ✅ | `00-agentes-globales.md` |
| F0 | T0.4 PRUEBA DE MODELOS intacta | ✅ | `00-agentes-globales.md` |
| F0 | T0.5 `agent list` → 8 (REINICIO) | ⏳ TUI | `00-agentes-globales.md` |
| F1 | T1.1 AGENTS.md | ✅ | `01-agents-legal.md` |
| F1 | T1.2 WORKFLOW_STATE.md | ✅ | `01-agents-legal.md` |
| F1 | T1.3 Permissions implementador | ✅ | `01-agents-legal.md` |
| F1 | T1.4 `@explorador` cita cap 3500px | ⏳ TUI | `01-agents-legal.md` |
| F2 | T2.1–T2.3 3 skills de dominio | ✅ | `02-skills-dominio.md` |
| F2 | T2.4 skill disparable | ⏳ TUI | `02-skills-dominio.md` |
| F2 | T2.5 Commit skills | ✅ | `b9044b7` |
| F3 | T3.1 comando `/spike` | ✅ | `03-spike-generado.md` |
| F3 | T3.2 `/ship` de proyecto | ✅ | `03-spike-generado.md` |
| F3 | T3.3 HTML del spike F0 | ✅ (instrumento) | `03-spike-generado.md`, `spike.html` |
| F3 | T3.4 a/b/c/d + T3.5 no-hardcode | ✅ | `03-spike-generado.md` |
| F3 | Ejecución del spike en dispositivos | ⏳ HUMANA | — |
| F4 | T4.1 MCPs 4/4 desde nuevo dir | ⏳ TUI (globales ✔) | `04-noregresion.md` |
| F4 | T4.2 Policy bloquea `.env` | ✅ | `04-noregresion.md` |
| F4 | T4.3 Fallback espejo | ⏳ TUI | `04-noregresion.md` |
| F4 | T4.4 Serena find_symbol TS | ✅ | `04-noregresion.md` |
| F5 | T5.1–T5.5 Cierre | ✅ | este documento |

## Cambios de configuración realizados (R7: SOLO permissions + agentes globales)

1. **Agentes globales (nuevo):** `~/.config/opencode/agents/` — se añadieron 7 archivos
   (orquestador ya existía). No se movió ni reescribió ninguno de PRUEBA DE MODELOS.
2. **Permissions puntuales:** `~/.config/opencode/agents/implementador-backend.md` → bloque `bash`
   ampliado con `npm run dev *`, `npm run build *`, `npx tsc *`, `npx vitest *` (junto a `npm test *`).
   Sin escalar `bash: "*": allow`.
3. **Sin cambios** en modelos/proveedores (`opencode.jsonc`) ni en plugins (`policy.ts`,
   `checkpoint.ts`). Verificado: `git -C ~/.config/opencode diff` vacío; solo agentes nuevos sin trackear.

## Hallazgos nuevos

1. **`copy-item -LiteralPath` no expande wildcards** — la promoción de agentes requiere `-Path`.
2. **Bug real detectado por la doble revisión del spike:** `aspectRatio:{ideal:4/3}` en constraints
   violaba AGENTS.md (aspect ratio se mide, no se solicita) y un `const a` duplicado era un
   SyntaxError de parseo. Ambos corregidos y validados (0 errores de consola). La doble revisión
   aportó: A cazó la violación de disciplina; B cazó el bug de sintaxis que invalidaba el fix de A.
3. **`opencode mcp list` en modo no-interactivo cuelga** → esa verificación es estrictamente TUI.
4. **Serena en Windows:** la activación de proyecto con 0 language servers aún resuelve
   `find_symbol` por análisis simbólico.

## Criterio de éxito

| # | Criterio | Estado |
|---|---|---|
| 1 | 8 agentes operativos desde mobile-scanner (global) | ✅ (confirmación TUI pendiente) |
| 2 | AGENTS.md legible/citable | ✅ creado (prueba TUI T1.4 pendiente) |
| 3 | 3 skills instaladas y disparables | ✅ instaladas (disparo TUI pendiente) |
| 4 | HTML del spike con doble revisor, sin hardcodear lo medido | ✅ |
| 5 | Cero regresiones del sistema base | ✅ (policy real; MCPs globales; Serena; pendientes TUI menores) |

**Cierre:** entorno adaptado y verificado en lo automatizable. La pelota pasa al humano:
abrir `spike.html` en 2-3 dispositivos reales y reportar los resultados para congelar el CameraProfile
y la tabla DPI.