# 00 — Agentes globales (Fase 0 · T0.3–T0.6)

## T0.3 Promoción a global — HECHO (automatizable)
7 agentes copiados de `PRUEBA DE MODELOS\.opencode\agents\` a `~/.config/opencode/agents\`
(el 8.º, `orquestador.md`, ya estaba en global).

| Agente | SHA256 (12) |
|---|---|
| orquestador.md | 12F35993958E |
| explorador.md | 309CD2E8FAEF |
| explorador-fallback.md | 758D1CF193CE |
| implementador-backend.md | 50D00099B306 |
| implementador-fallback.md | 80C4B34B1124 |
| revisor.md | 68D2CABA1EE3 |
| revisor-b.md | AB00DC79BEBE |
| revisor-fallback.md | 122FD716DA04 |

Verificación de copia: hash global == hash local para los 7 (diff vacío).

## T0.4 PRUEBA DE MODELOS intacta — HECHO
`.opencode/agents/` local conserva sus 7 archivos; no se borró ni modificó ninguno.

## T0.5 REINICIO + `opencode agent list` — HECHO (verificado 2026-09-20 tras reinicio)
Tras reiniciar opencode, `opencode agent list` devuelve **8 agentes globales propios** junto a
los built-in (build, compaction, plan, summary, title, explore, general):

`explorador`, `explorador-fallback`, `implementador-backend`, `implementador-fallback`,
`orquestador`, `revisor`, `revisor-b`, `revisor-fallback`.

Permisos confirmados visibles por agente (p. ej. `implementador-backend` expone
`npm test *`, `npm run dev *`, `npm run build *`, `npx tsc *`, `npx vitest *` =
los añadidos en T1.3; `orquestador` = task allow / read allow / edit+bash deny).

## T0.6 Verificación — HECHO (automatizable)
- `PLAN_MAESTRO.md` presente en la raíz.
- 8 agentes en global.
- `git` inicializado con commit inicial `5cec40a`.

**Estado del checkpoint:** ⏳ T0.5 pendiente de confirmación visual en TUI.