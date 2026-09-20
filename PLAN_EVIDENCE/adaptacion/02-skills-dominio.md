# 02 — Skills de dominio (Fase 2 · T2.1–T2.5)

## T2.1/T2.2/T2.3 — HECHO
3 skills creadas en `.opencode/skills/<nombre>/SKILL.md` (proyecto), extrayendo el contenido
DESDE el PLAN_MAESTRO v3.0 (no inventado). Frontmatter validado:

| Skill | `name` (regex ✓) | `description` (1–1024) |
|---|---|---|
| opencv-wasm-memoria | `opencv-wasm-memoria` ✓ | 253 chars ✓ |
| ios-camera-quirks | `ios-camera-quirks` ✓ | 265 chars ✓ |
| spike-dispositivos | `spike-dispositivos` ✓ | 236 chars ✓ |

Contenido por skill:
- **opencv-wasm-memoria**: wrapper `withMats()` de referencia, ciclo de vida del `cv.Mat` en worker,
  errores comunes (early-return, excepción antes del `finally`), procedimiento del test de estrés
  (10 min, `performance.memory` + memoria WASM, criterio <50MB), referencia a riesgo §9.
- **ios-camera-quirks**: tabla de rutas A/B/C con DPI por ruta (§4), `<video playsinline muted>`,
  EXIF `createImageBitmap(blob,{imageOrientation:'from-image'})`, torch con degradación silenciosa,
  `storage.persist()`+`estimate()`, `vibrate` inexistente en iOS → flash visual.
- **spike-dispositivos**: checklist del spike F0, formato del CameraProfile log (`anchoQuadPx/8.27`),
  plantilla de la tabla DPI (§4), REGLA agente-genera-instrumentos / humano-ejecuta.

## T2.4 Skills disparables — ⏳ PENDIENTE (checkpoint humano/TUI)
Para verificar: reiniciar opencode → pedir a `@implementador-backend` prepararse para tocar código
del worker → debe referenciar el `withMats()` de la skill `opencv-wasm-memoria`.

## T2.5 Commit — HECHO
Commit `b9044b7` "feat: skills de dominio (opencv-wasm, ios-quirks, spike); docs de proyecto".

**Estado del checkpoint:** ⏳ T2.4 pendiente.