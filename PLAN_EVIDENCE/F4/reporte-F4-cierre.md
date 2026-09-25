# Reporte formal de cierre — F4 (Editor + Colector + Diana)

**Fecha de cierre:** 2026-09-25 · **Estado:** ✅ CERRADA — código + validación humana completa en 2 dispositivos
**Alcance (PLAN_MAESTRO §F4):** editor de esquinas táctil con loupe · colector de dataset opt-in · diana de calibración con CDE "±X mm al 95%".

## 1. Qué entrega F4 (todo pagado)

| Componente | Estado | Evidencia |
|---|---|---|
| `AdjustEditor` (editor overlay: drag 4 handles, loupe, validación en vivo, confirm/revert/cancel) | ✅ | `PLAN_EVIDENCE/F4-validacion/reporte-F4-validacion-ronda1.md` + ronda 2 |
| Editor integrado al orquestador (`submitEditedQuad`/`revertEditedQuad`, FSM `editing`, cooldown) | ✅ | 314/314 tests · E2E artefacto |
| Colector dataset opt-in (contrato `DatasetEntry`, IndexedDB, export ZIP, anti-sesgo) | ✅ | 17/17 registros de 2 dispositivos cumplen contrato |
| Diana de calibración (`dianaMath.ts` puro + modo diana en harness) | ✅ | 13/13 tests · números reales en 2 plataformas |
| Anti-sesgo: el registro NUNCA mezcla lo automático con lo ajustado | ✅ | `adjustedQuad` ≠ `quadRefined` en los datos; `autoQuad` preservado |

## 2. Cadena de incidentes hasta la validación (lecciones)

1. **F4-fix-arranque** (`6403db4`): boot all-or-nothing; fallo del CDN de opencv (403 Cloudflare anti-datacenter) dejaba preview vivo + botones muertos. Fix: botón de inicio + error visible + reintento.
2. **F4-fix-typo-editBtn** (`46ccfd4`): el F4 seguía muerto — causa raíz REAL: typo `$('#editBtn')` (getElementById con `#`) → `main()` moría antes del frameLoop. **Lección:** la E2E anterior nunca ejercitó un boot completo; todo arranque futuro se testea hasta el final de `main()`.
3. **F4-validación ronda 1** (`5b34bef`): 3 hallazgos del humano — lupa bajo el dedo (→ lado opuesto), badges de refine fantasma (→ solo con info real), confirmar muerto en captura manual (→ validación EN VIVO + banner + `.catch`).
4. **f4-fix-stale-fellback** (`b8fe9b7`): el manifest ronda 1 reveló `autoQuad: null` + `fellBack` heredado de la captura anterior. Fix: `fbOf(photo)` — `fellBack` válido SOLO si la foto fue warpeada. E2E nueva con worker falso por protocolo real.

## 3. Validación humana ronda 2 (la que cierra)

**Canales:** los adjuntos fallan sistemáticamente (5 intentos) → manifest pegado como texto + fotos/ZIPs por GitHub (ramas `dataset-muestra` y `dataset-ronda2`). Parches verificados byte-exactos en `origin/main`.

**Colector — 17 registros, 2 plataformas:**

| | Samsung SM-A566E | iPhone 17 Pro |
|---|---|---|
| Registros / contrato | 7 (7/7 ✓) | 10 (10/10 ✓) |
| Condiciones | 5 etiquetas del catálogo | 5 etiquetas del catálogo |
| autoQuad / sin detección | 6 / 1 | 8 / 2 |
| **adjustedQuad** | **3** | 0 |
| revalScore | 733–4699 | 590–8253 |
| Foto | 1200×1600 | 900×1600 (track apaisado 3840×2160 — orientación correcta, quads foto-relativos) |

- **Edición clásica** (`f8d142a8`, `c16f230f`): el quad ajustado APRIETA el holgado automático — verificado visualmente (hoja de contactos).
- **Recuperación manual total** (`3a8822e4`, fondo-claro): sin detección → humano coloca 4 esquinas → re-warp (reval 4186). El dataset registra el fallo del auto Y la corrección humana. **Hallazgo de contrato:** el `fellBack` de ese registro pertenece al refine del quad MANUAL (`submitEditedQuad` → `deps.requestWarp` refresca la meta) — la regla "autoQuad null ⇒ fellBack null" del validador era demasiado estricta; la regla correcta exige WARP (auto o ajustado), no auto. Refinada en `scripts/analyze-manifest-r1.mjs`.
- **Camino nulo honesto en iOS:** foto accidental del piso (`c9b27871`) registrada con `autoQuad: null`, `fellBack: null`, sin contaminar el dataset.

**Diana (modo diana, ancho impreso medido 185 mm):**

| Dispositivo | CDE al 95% | N |
|---|---|---|
| Samsung SM-A566E | **±58.44 mm** | 5 |
| iPhone 17 Pro | **±23.99 mm** | 7 |

Instrumento operativo (`cdeReport`), capturas de pantalla en `colector/ronda2/`. Nota de protocolo: capturas a pulso → el residuo esquina↔media incluye variación de encuadre del operador; con N=5–7 un outlier domina el p95 (el ±58.44 de Samsung sugiere una captura con encuadre distinto). Para ruido puro del detector: repetir a distancia fija. El plan §289 pide reportar el número, no fija umbral.

## 4. DoD de F4

- ✅ Editor táctil usable en dispositivo (lupa opuesta al dedo, confirmación visible y funcional).
- ✅ Colector opt-in (default OFF) produce datasets conformes al contrato, con condiciones etiquetadas y anti-sesgo trazable.
- ✅ Diana entrega "±X mm al 95%" real en 2 plataformas.
- ✅ 314/314 tests unitarios · tsc limpio · E2E de harness en verde.

## 5. Handoff a F6.5 (dataset)

- El colector es el insumo del dataset F6.5 (300-500 imágenes). Notas ya registradas: variar tipos de documento (7/9 ronda 1 = mismo recibo), fondo oscuro para documentos claros, sombra uniforme, descartar capturas basura antes de entrenar.
- El trigger F6.5 (>15% ajustes manuales) se medirá con telemetría opt-in de F6.
