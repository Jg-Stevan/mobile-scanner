# Reporte colector F4 — RONDA 2 (multi-dispositivo: Android + iOS)

**Fecha:** 2026-09-25 · **Fuente:** 2 ZIPs exportados del colector y pusheados por el humano en la rama `dataset-ronda2` (`PLAN_EVIDENCE/F4/colector/ronda2/`) — sexto y séptimo envío por GitHub tras 5 fallos del gateway de adjuntos.
**Dispositivos:** Samsung SM-A566E (`other`, track 2160×3840) · iPhone 17 Pro (`ios`, track 3840×2160) — ambos corriendo el build desplegado en `jg-stevan.github.io/mobile-scanner` con los 3 parches de la ronda 1 aplicados (verificado byte-exacto: `git diff b8fe9b7 origin/main -- src/ harnesses/ f4/` = vacío).
**Datos crudos:** `ronda2/SM-A566E/f4-SAMSUNG-1790346127618.zip` (7 registros + 7 fotos) · `ronda2/IPHONE-17-PRO/f4-dataset-1790347702875.zip` (10 registros + 10 fotos).
**Analizador:** `scripts/analyze-manifest-r1.mjs` (regla de invariante REFINADA esta ronda, ver Hallazgo 1) · **Auditoría visual:** `scripts/dataset-contact-sheet.mjs` → `dataset-f4-ronda2-samsung.png` + `dataset-f4-ronda2-iphone.png`.

## Resumen por dispositivo

| Métrica | Samsung SM-A566E | iPhone 17 Pro |
|---|---|---|
| Registros (contrato) | 7 (7/7 ✓) | 10 (10/10 ✓) |
| Duración / gaps | ~224 s (23,6,43,69,14,68) | ~137 s (7,24,3,10,46,31,9,4,3) |
| Ruta | 7× A | 10× A |
| Condiciones | normal 1 · poca-luz 2 · fondo-claro 1 · inclinado 2 · sombra 1 | normal 1 · poca-luz 1 · fondo-claro 2 · inclinado 2 · sombra 4 |
| autoQuad / sin detección | 6 / 1 | 8 / 2 |
| **adjustedQuad** | **3** ← primero en dispositivo real | 0 |
| fellBack | 0/4 ×5 · 1/4 ×2 | 0/4 ×6 · 1/4 ×2 · 4/4 ×1 · sin refine ×2* |
| revalScore | min 733 · med 4142 · max 4699 | min 590 · med 4755 · **max 8253** |
| Foto | 1200×1600 (3:4) | 900×1600 (9:16 retrato) |
| Diana CDE | **±58.44 mm al 95% (N=5; ancho 185 mm)** | **±23.99 mm al 95% (N=7; ancho 185 mm)** |

\* "sin refine": `f14c72c9` (recibo arrugado sin detección, reval 7039 sobre la cruda) y `c9b27871` (foto del piso/pie — captura basura legítima). Ambos `autoQuad: null` + `fellBack: null` = camino nulo honesto en iOS.

## Los 3 ítems pendientes de F4 — CUBIERTOS

### 1. Editor re-test (lupa opuesta + Confirmar manual) ✓ vía dataset
Los 3 `adjustedQuad` de Samsung son la prueba persistente de que el camino editor→Confirmar→re-warp→`addAdjusted` funciona end-to-end en dispositivo (los commits 5b34bef/b8fe9b7 ya corregían lupa/banners/typo). Dos caminos distintos quedaron trazados:
- **Edición clásica** (auto detectado → humano afina): `f8d142a8` (inclinado) y `c16f230f` (sombra) — el quad azul punteado APRIETA donde el verde automático quedaba holgado (verificado visualmente en la hoja de contactos).
- **Recuperación manual total** (auto FALLÓ → humano coloca 4 esquinas): `3a8822e4` (fondo-claro) — recibo rosado sobre mesa gris, `autoQuad: null`, quad azul colocado a mano enmarca el recibo con precisión, re-warp exitoso (reval 4186). **El dataset registra honestamente el fallo del auto Y la recuperación humana.**

### 2. Diana de calibración ✓ en 2 plataformas
`cdeReport` (`src/core/dianaMath.ts`, 13/13 tests unitarios verdes en sandbox) corrió en dispositivo: Samsung `±58.44 mm al 95% (5; ancho 185 mm)`, iPhone `±23.99 mm al 95% (7; ancho 185 mm)` — capturas de pantalla `SAMSUNG.jpeg` / `IPHONE 17 PRO.jpeg`. El plan (§289) pide reportar el número, no fija umbral: **instrumento de diagnóstico operativo**. Nota de protocolo: el residuo esquina↔media entre capturas incluye la variación de encuadre/distancia del operador (capturas a pulso); para aislar el ruido puro del detector haría falta repetir a distancia fija (trípode). Con N=5–7 un outlier domina el p95 — Samsung ±58 mm sugiere 1 captura con encuadre distinto.

### 3. Capturas CON edición (adjustedQuad ≠ 0) ✓
3 registros en Samsung (ronda 1 tenía 0). iPhone sin ediciones en esta sesión — válido, el camino ya quedó validado en Samsung.

## Hallazgo 1 — La regla de invariante era demasiado estricta (refinada, sin bug en runtime)

`3a8822e4` llega con `autoQuad: null` + `adjustedQuad: non-null` + `fellBack: [T,F,F,F]`. El validador ronda 1 lo marcaba "INVARIANTE ROTO (meta stale)". **Verificación contra el código descarta el stale**: `submitEditedQuad` (ScanOrchestrator.ts:432) → `warpPhoto` → `deps.requestWarp` → el harness refresca `lastWarpMeta` (línea 389) → `onEdited` → `st.addAdjusted(..., fbOf(p))` con `p.warped` recién warpeado. El `fellBack` pertenece al refine del quad MANUAL — legítimo. **Regla correcta**: `fellBack non-null` exige warp (auto O ajustado); solo es stale si NO hay ni autoQuad ni adjustedQuad. Parche incluido en `scripts/analyze-manifest-r1.mjs`. Con la regla refinada: 17/17 registros limpios. El fix `fbOf` de la ronda 1 sigue siendo correcto y necesario (E2E `test-f4-stale-fellback` cubre el caso sin editar).

## Hallazgo 2 — Cross-plataforma iOS validado (primera vez)

iPhone 17 Pro (Safari, `jg-stevan.github.io`): contrato 10/10 limpio, detección funciona, **orientación correcta** — el track reporta 3840×2160 (apaisado, sensor nativo) pero las fotos salen 900×1600 retrato y los quads en fracciones quedan alineados con la foto (detectPhoto corre sobre la foto, no sobre el frame del track). `fondo-claro` en iPhone DETECTA 2/2 (fondo verde-oliva más oscuro → hay contraste), mientras en Samsung ronda 1 con mesa gris clarito falló — consistente con la hipótesis de contraste documento/fondo. El revalScore máx del dataset completo salió en iPhone (8253, recibo en sombra).

## Observaciones menores (sin acción bloqueante)

1. Samsung muestra "Dataset: 8/300 (pausado)" en pantalla pero el ZIP trae 7 — 1 registro de diferencia (captura posterior al export o limpieza puntual). No afecta: el manifest exportado es autoconsistente.
2. `c9b27871` (iPhone, inclinado): foto del piso con el pie del operador — captura accidental registrada con `autoQuad: null`, `fellBack: null`, reval 590. El camino nulo la absorbe sin contaminar; para el dataset F6.5 de 300 se recomienda descartar manualmente las basuras antes de usarlas.
3. `f14c72c9` (iPhone, sombra): recibo MUY arrugado sin detección (reval cruda 7039 — el arrugado rompe los contornos). Caso límite valioso para F6.5; también candidato a edición manual como `3a8822e4`.
4. El diana se midió con ancho impreso 185 mm (la diana canónica de `gen-diana.mjs` es 190.5 mm — el humano midió su impresión real, correcto: lo que importa es el ancho MEDIDO, no el nominal).

## Veredicto

**El colector F4 está VALIDADO en dispositivo real en 2 plataformas** (Android Chrome + iOS Safari): contrato de datos 17/17, caminos nulo/editado/recuperado todos trazables, anti-sesgo intacto (el registro no mezcla auto con ajuste), diana operativa con números reales. **F4 puede cerrarse formalmente.** Pendiente de cierre documental: reporte formal F4 + actualización WORKFLOW_STATE.md/DOSSIER-IA.md → F5.
