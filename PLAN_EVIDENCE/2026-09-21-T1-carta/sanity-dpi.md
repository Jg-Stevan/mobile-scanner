# Evidencia T1-R — Migración A4 → Carta (2026-09-21)

## Sanity aritmético (fórmula, no umbral)
- Quad por defecto 0.28–0.72 del ancho sobre track 1920px:
  `anchoQuadPx = (0.72 − 0.28) × 1920 = 844.8 px`
- DPI carta: `844.8 / 8.5 = 99.4 DPI` ✓ (verifica la fórmula `anchoQuadPx / PAPER_DEFAULT_IN`)
- Referencia A4: `844.8 / 8.27 = 102.2 DPI` (solo informativa)

## Verificación de residuales
- `spike.html`: `8.27` solo en label informativo (línea 126) y comentario de
  `PAPER_DEFAULT_IN` (línea 157). Cero `|| 8.27`, `value="8.27"`, `/ 8.27` en JS.
- Residuales `8.27` restantes solo en docs históricos de evidencia
  (`PLAN_EVIDENCE/tareas/T1-carta.md` = spec del cambio, `current_plan.md`,
  `adaptacion/03-spike-generado.md`) — historia, NO se editan.
- Coherencia extra T1-R: `.opencode/command/spike.md`,
  `skills/ios-camera-quirks/SKILL.md`, `skills/spike-dispositivos/SKILL.md`
  y header de `spike.html` migrados a Carta / PLAN_MAESTRO v3.1
  (evita regresión si se re-ejecuta `/spike`).

## Archivos en esta carpeta
- `spike-dpi-8.5-full.png` — screenshot Playwright real del panel "Medición de
  DPI runtime" mostrando campo `8.5` + `(Carta = 8.5 · A4 = 8.27)` + rangos carta.
  (Único error de consola: favicon 404, irrelevante.)
- `git-diff-stat.txt` / `git-diff.txt` — diff del cierre T1-R.
