## Plan: delegación ZCode (planifica/revisa) + opencode (implementa)

### Fase A — Documentar la política de modelos

Actualizar el registro en `C:\Users\JG\opencode-historial\catalogos\` (nueva sección en `MODELOS-EXPLORACION.md` o archivo `roles-modelos.md`) con la asignación aprobada:

| Rol | Modelo | Uso |
|---|---|---|
| Implementador | `opencode/muse-spark-1.3-contributor-free` | Código desde orden de trabajo (piloto F2-c) |
| Workhorse mecánico | `opencode/nemotron-3.5-lightning-free` | Exploración, docs, boilerplate tests, HTML harness |
| Revisor/diagnóstico duro | `opencode/nemotron-3-ultra-free` | Solo tras 2 fallos del escalón anterior |
| Visión | `opencode/mimo-v2.6-flash-free` | Screenshots/capturas del harness |
| Reserva refactor | `opencode/big-pickle` | Diffs grandes deliberados; no gastar por defecto |
| Parqueado | `opencode/ling-3.0-flash-fin-free` | Sin rol en mobile-scanner |
| Emergencia | `opencode/muse-spark-1.2-contributor-free` | Solo si 1.3 da rate-limit (78% cuota ya usada) |

Reglas anti-despilfarro incluidas en el documento:
1. Escalera ascendente (lightning → 1.3 → ultra), nunca al revés
2. A opencode solo se le pasa la orden de trabajo (`-f`), nunca el repo entero
3. Iteraciones con `-s <session-id>` (sesión, no re-envío de contexto)
4. Sin tocar `.opencode/` — el modelo se pasa siempre por flag `-m` (decisión del usuario)

### Fase B — Piloto F2-c con el protocolo

1. Escribo `TAREAS/F2-c.md` (carpeta nueva en el repo): orden de trabajo completa del criterio k-de-n aprobado (≥4 de últimas 6 muestras >0.8 en 1200ms, última muestra buena; retención de `scoreHistory` a `SHUTTER_SPAN_MS + 200` = 1400ms; reescritura de tests; higiene: entrada fantasma "Sonda modelos-v2" en WORKFLOW_STATE, flash iOS del harness). Incluye prohibiciones (no tocar `tests/bench/`, `PLAN_EVIDENCE/`, umbrales de `src/core/`, `.opencode/`) y criterios de aceptación (`npm test` verde con 153 tests, `npx tsc --noEmit` limpio).
2. Lanzo: `opencode run -m opencode/muse-spark-1.3-contributor-free --title "F2-c k-de-n" "$(cat TAREAS/F2-c.md)"` desde mi terminal.
3. Verifico yo mismo: `npm test`, `npx tsc --noEmit`, revisión del diff contra la especificación (withMats, umbrales, coordenadas). Si falla, itero con `-s <session-id>` en la misma sesión de opencode; si falla 2 veces, escalo el modelo según la escalera.
4. Al terminar: auditó su sección de WORKFLOW_STATE.md y dejo el commit pendiente para ti (regla M2: commit manual).

### Lo que NO se hace
- No se tocan `.opencode/`, `PLAN_EVIDENCE/`, `tests/bench/`, PLAN_MAESTRO
- No se integran modelos nuevos a la cadena de fallbacks permanente (gpt-sol sigue en su registro de probes, separado)
- No se ejecutan validaciones en dispositivo físico (siguen siendo tuyas)