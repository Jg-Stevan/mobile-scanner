# TAREA T1 — Migración de formato de papel: A4 → Carta (Letter)

**Delegación:** @orquestador planifica y delega via `task`. Ediciones → @implementador-backend.
Verificación → @explorador + playwright. Cierre → /ship (doble revisor).
**Alcance:** spike.html + documentos de gobierno. **NO existe código de producción aún
(core/, camera/): NO crearlo.** Cada fase termina en verificación; si falla, DETENERSE.

## 0. Contexto (obligatorio leer antes de delegar)

- Decisión de producto del humano: formato de referencia = **CARTA (8.5 × 11 in)**,
  A4 queda como alternativa documentada. Motivo: estándar regional + disponibilidad
  real de papel en el entorno de medición.
- PLAN_MAESTRO v3.0 está CONGELADO → este cambio se procesa como **DESVIACIÓN
  DOCUMENTADA** (metodología §7.6: se registra como hallazgo, no se oculta).
- Disciplina AGENTS.md aplicable: PROHIBIDO hardcodear → **una sola constante**.
- Los valores numéricos de esta tarea son CONSTANTES DADAS. Los agentes NO los
  recalculan ni "redondean".

## Fase 1 — Registro de desviación (gobernanza primero)

Delegar a @implementador-backend:
1. `WORKFLOW_STATE.md` → nueva entrada:
   `Desviación D1 (aceptada por humano): formato de referencia A4 → CARTA (8.5×11 in).`
   Motivo + fecha + tarea T1.
2. `PLAN_MAESTRO.md` → header `v3.0` → `v3.1` + línea en changelog:
   `v3.1 — D1: formato carta como referencia (spike, diana F4, export F5). Tabla §4 recalculada.`
3. NO modificar NO-GOALS, stack ni fases: solo lo referente a papel.

**Verificación:** @explorador cita archivo+línea de ambas ediciones. Falta → STOP.

## Fase 2 — spike.html (constante única + 6 ediciones)

Crear constante al inicio del `<script>`:
```js
const PAPER_DEFAULT_IN = 8.5; // Carta. A4 = 8.27 (ver PLAN_MAESTRO §4)
```

Ediciones exactas:
| # | Ubicación | Antes | Después |
|---|---|---|---|
| 1 | HTML input `paperWidthIn` | `value="8.27"` | `value="8.5"` |
| 2 | Label del input | `(A4 = 8.27)` | `(Carta = 8.5 · A4 = 8.27)` |
| 3 | Instructivo DPI | "hoja <b>A4</b> llenando el encuadre" | "hoja <b>tamaño carta, VERTICAL</b> llenando el encuadre (ancho visible = 8.5 in)" |
| 4 | `dpiCompute` fallback | `|| 8.27` | `|| PAPER_DEFAULT_IN` |
| 5 | `collectReport` fallback | `|| 8.27` | `|| PAPER_DEFAULT_IN` |
| 6 | Texto de referencia §4 en el spike | rangos A4 (~360 / ~130-165 / ~260-330 / >300) | rangos carta de la tabla de Fase 3 |

**NO tocar:** la advertencia de cap ~3500px en `renderProfileLog` (sigue válida),
torch, rutas de captura, checklist del spike.

**skill `spike-dispositivos`:** NO cambiar el modelo/correspondencia de la skill (su
"Regla de diseño" y el enfoque cuadrilátero-manual siguen intactos). PERO verificar si
menciona A4 como obligatorio → si sí, edición mínima de ese literal (A4→Carta y el DPI
asociado, espejo de la tabla §4 v3.1) incluida en esta fase, con evidencia.

**Verificación:** @explorador confirma que ya NO existe el literal `8.27` como fallback
de JS (solo puede quedar en el label informativo del punto 2). STOP si queda alguno.

## Fase 3 — PLAN_MAESTRO.md: §4, F3, F4, F5 (valores dados, no inventados)

1. **§4 — Tabla de DPI con carta** (reemplazar la de A4):
   | Ruta | DPI efectivo (Carta) |
   |---|---|
   | Android takePhoto 12MP (3000×4000) | ~353–364 |
   | iOS track 1080p | ~127–175 |
   | iOS track 4K (si getSettings() confirma) | ~254–349 |
   | iOS manual (input capture, full sensor) | ~356+ |
   + Nota: cifras exactas las fija el spike real por dispositivo; la tabla es referencia.
2. **F3 — cap 3500px:** añadir nota `3500/11 = ~318 DPI en carta → cap VALIDADO, sin cambio numérico`.
3. **F4:** diana de calibración se imprime en **carta**.
4. **F5:** exportación PDF con **Letter como tamaño de página default, opción A4**.

**Verificación:** @explorador cita las 4 secciones editadas. STOP si falta alguna.

## Fase 4 — Verificación funcional + evidencia + cierre

1. **Playwright MCP** (evidencia): abrir `spike.html` → screenshot del panel
   "Medición de DPI" mostrando el campo con `8.5` → guardar en
   `PLAN_EVIDENCE/2026-09-21-T1-carta/` (junto al diff de `git diff`).
2. **Sanity aritmético documentado:** con quad por defecto (0.28–0.72 del ancho) sobre
   track 1920px → anchoQuadPx ≈ 844 → DPI ≈ 844/8.5 ≈ **99**. Registrar el cálculo en
   la carpeta de evidencia (solo verifica la fórmula, no es umbral).
3. **/ship** sobre el diff completo (revisor + revisor-b). Desacuerdo → findings
   numerados → orquestador juzga.
4. `WORKFLOW_STATE.md` → T1 cerrada con: archivos cambiados + verificación ejecutada
   + ruta de evidencia.

## DoD (todo debe cumplirse)

- [ ] `WORKFLOW_STATE.md` registra D1
- [ ] PLAN_MAESTRO v3.1 con changelog
- [ ] spike.html: constante única + 6 ediciones + cero `8.27` residual en JS
- [ ] §4/F3/F4/F5 actualizados con valores de esta tarea (sin recalcular)
- [ ] Screenshot playwright + diff en PLAN_EVIDENCE/
- [ ] /ship aprobado por ambos revisores
