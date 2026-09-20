# 04 — No-regresión del sistema base (Fase 4)

## T4.1 MCPs 4/4 desde el nuevo directorio — ⏳ PARCIAL
- Los 4 MCPs son **globales** (`~/.config/opencode/opencode.jsonc`): `context7`, `playwright`,
  `sequential-thinking`, `serena` — todos `"enabled": true`. Al ser globales, heredan a mobile-scanner.
- Evidencia de conexión en esta sesión: **serena** (activación de proyecto + `find_symbol`, ver T4.4),
  **playwright** (carga del spike en navegador), **sequential-thinking** disponibles.
- ⏳ PENDIENTE (TUI): ejecutar `opencode mcp list` desde `C:\Users\JG\projects\mobile-scanner` →
  esperado 4/4 connected. `opencode mcp list` en modo no-interactivo cuelga; requiere TUI/REINICIO.
  Si serena no arranca aquí, documentar: probablemente pide activación de proyecto (ya resuelto en T4.4).

## T4.2 Plugin policy — ✅ HECHO (evidencia real)
`~/.config/opencode/plugins/policy.ts` bloquea `read|edit|write|bash|patch` cuyo path/command
case contra `/\.env(\.|$)|\.pem(\s|$)|credentials|id_rsa/i`.
- Fixture `.env` creado en la raíz del proyecto (excluido por `.gitignore` → `.env*`).
- Test: intento de lectura del `.env` → **`⛔ Política: archivo sensible bloqueado`**. Bloqueado. ✅

## T4.3 Fallback espejo — ⏳ PENDIENTE (TUI)
- Mecanismo presente: agentes espejo en global → `explorador-fallback.md`, `implementador-fallback.md`,
  `revisor-fallback.md` (ver evidencia 00).
- ⏳ PENDIENTE: simular fallo de un agente en TUI y confirmar la re-delegación al espejo.

## T4.4 Serena sobre TS del nuevo repo — ✅ HECHO
- Proyecto activado: `serena_activate_project("C:\Users\JG\projects\mobile-scanner")` → proyecto
  `mobile-scanner` creado y activo.
- `serena_find_symbol("CameraProfile", "src/core/types.ts")` →
  `{ name_path: "CameraProfile", kind: "Interface", lines 19–28 }`. ✅
- Nota: Serena reportó 0 language servers activos; `find_symbol` resolvió por análisis de símbolos
  igualmente. Para navegación TS más rica, verificar el LSP typescript al reiniciar.

## Resumen Fase 4
| Ítem | Estado |
|---|---|
| T4.1 MCPs 4/4 desde nuevo dir | ⏳ TUI (globales confirmados) |
| T4.2 Policy `.env` | ✅ bloqueado (real) |
| T4.3 Fallback espejo | ⏳ TUI (agentes presentes) |
| T4.4 Serena find_symbol | ✅ hecho |