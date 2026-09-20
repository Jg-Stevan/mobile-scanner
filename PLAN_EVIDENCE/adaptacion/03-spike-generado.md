# 03 — HTML del spike generado (Fase 3 · T3.3–T3.5)

## Entregable
`spike.html` — commit `3aea9af` · SHA256 `523670EBA06DBC11…` · un solo archivo autocontenido
(HTML+CSS+JS inline, sin dependencias ni build).

## T3.4 Verificación
- **a) Archivo único sin build** — ✅ abrible directo. Validado por servidor local temporal +
  navegador: carga limpia, **0 errores de consola** tras la corrección de la doble revisión.
- **b) Doble veredicto A+B** — ✅ (ver abajo).
- **c) Plan del orquestador** — ✅ `PLAN_EVIDENCE/current_plan.md`.
- **d) WORKFLOW_STATE.md** — ✅ "F0 spike: instrumento generado, pendiente ejecución humana".

## T3.5 No hardcodear lo que el spike debe medir — ✅
El instrumento **mide en runtime**: resoluciones vía `getSettings()`, capabilities vía
`getCapabilities()`, DPI vía quad manual (`anchoQuadPx / 8.27`). No contiene resoluciones ni DPI
fijos como datos de medición. La única constante física es el ancho de papel A4 (8.27 in), que es
la referencia física de la fórmula del plan, editable por el usuario.

---

## Doble revisión (A = `revisor`, B = `revisor-b`, independientes)

### Revisor A (veredicto inicial: CHANGES_REQUESTED → re-revisión: APPROVED)
Findings:
1. **[BLOQUEANTE — disciplina]** El bloque `constraints` pedía `aspectRatio: {ideal: 4/3}`.
   AGENTS.md prohíbe hardcodear aspect ratios (4:3/16:9): el video es un crop del sensor y el
   ratio se **mide**. → **Corregido**: constraints solo con `width/height` ideales; el ratio se lee
   de `getSettings()`.
2. **[MAYOR — robustez]** `deviceId: {exact}` sin fallback podía dejar la cámara inutilizable si el
   device cambia. → **Corregido**: reintento sin `deviceId` si falla.
3. **[MENOR]** `drawQuad()`/`displayRect()` sin guard de `videoWidth===0` (NaN antes de metadatos).
   → **Corregido**: early-return.

Re-revisión: los 3 findings resueltos → **APPROVED**.

### Revisor B (`revisor-b`, escueto)
1. `const a` declarado dos veces en `displayRect()` (SyntaxError de parseo; además impedía validar
   el finding 3 de A). → Corregido.
2. Confirmado tras fix: **APPROVED**.

### Desacuerdo
Ninguno: ambos APPROVED tras corregir. Aportes complementarios (A: disciplina/robustez; B: bug de
sintaxis). El bug de sintaxis de B es el que habría roto la validación de A, lo que demuestra el
valor del doble revisor.

## Cobertura del instrumento vs. checklist §5-F0
| Ítem del spike | Dónde |
|---|---|
| `getSettings()` ¿4K iOS? | panel "Diagnóstico en vivo" |
| `takePhoto()` res/latencia/fallos | test ruta A (N tentativas) |
| iOS input capture ¿1 o varias fotos? | test ruta C (cuenta archivos por gesto) |
| `createImageBitmap from-image` Safari | test EXIF (sobre archivos de ruta C) |
| capabilities torch/focus/tele | panel capabilities + enumerateDevices |
| DPI runtime `anchoQuadPx/8.27` | sección DPI con quad manual |

## Ejecución
**⏳ PENDIENTE — HUMANA.** Abrir `spike.html` en 2-3 dispositivos reales (incl. iPhone físico),
llenar la checklist del spike, exportar el reporte y entregarlo al orquestador.