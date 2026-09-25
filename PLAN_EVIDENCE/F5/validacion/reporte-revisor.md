# Revisión del revisor (IA) — evidencia humana F5, lotes 1 y 2

**Fecha**: 2026-09-26 · **Revisor**: agente IA (revisión forense de los 4 PDFs, 3 JSONs de CER y código del harness) · **Veredicto global**: pruebas humanas BIEN ejecutadas; los hallazgos son de la app, y F6.5 los ataca.

## 1. Verificación mecánica

| Artefacto | Páginas | Imágenes embebidas | Veredicto |
|---|---|---|---|
| lote 1 · `scanner-1790368025567.pdf` (5.28MB) | 3 (Letter) | 1114×3468, 2112×2710, 1770×2366 | export OK |
| lote 1 · `scanner-1790370839340.pdf` (4.20MB) | 3 (Letter) | MISMAS dims, bytes distintos | **mismo documento en otro modo** ✓ |
| lote 2 · `scanner-1790373027082.pdf` (0.13MB) | 1 (Letter) | 1143×3500 (112KB) | modo bw: ~10× más barato ✓ |
| lote 2 · `scanner-1790373351073.pdf` (2.30MB) | 2 (Letter) | 1143×3500, 1038×3364 | < 3MB DoD ✓ |

Peso por página medido (q0.90, sin re-escala): 1.0–1.9MB. La página-ruido del lote 1 era la MÁS cara (1.91MB / 1.76MB por modo): el ruido aleatorio no comprime en JPEG.

## 2. Contenido: actas E-14 arrugadas (caso real difícil)

- **pg1 y pg2 legibles** en ambos lotes; el modo natural (lote 2/p2) muestra fondo notablemente más blanco y limpio que el otro modo exportado.
- **pg3 del lote 1 = ruido puro** (en ambos modos): el warp atrapó textura (la "diana" del humano, mal encuadrada — ver §4). Terminó en el PDF sin poderse corregir: motivación directa del editor en f5 (F6.5).

## 3. Banding D-F5-b — CONFIRMADO visualmente

Crop al 100% de zona plana del pg2 del lote 1 (`banding-crop-100pct-lote1-pg2.png` en este directorio): **bloques tonales rectangulares con escalones de gris** sobre el papel — banding de tiles CLAHE clásico, más amplificación de textura. Coincide con el hallazgo CER del lote 2 (§5): el CLAHE agresivo es el que más daña el OCR en este material.

## 4. Sobre la "diana" del lote 1 (aclaración de protocolo)

El harness CER **no necesita la diana**: mide cuánto DEGRADA cada modo el OCR frente al OCR de la MISMA captura sin procesar (referencia = OCR del original, por diseño §F5 "antes/después del enhance"). Cualquier página legible sirve; la diana es solo un blanco cómodo de texto denso. Lo que invalidó el lote 1 no fue "usar la diana" sino que **la captura misma salió ilegible** (warp de textura → referencia = 4,966 caracteres de ruido → CER 0.62–0.69 sin significado). El lote 2, con capturas legibles, produce números válidos.

## 5. CER lote 2 — primer ranking válido por modo

| Medición | color | gray | bw | natural |
|---|---|---|---|---|
| 1 (ref 634 chars) | 0.2461 | **0.6483** | 0.2997 | **0.1751** ✓ |
| 2 (ref 703 chars) | 0.4708 | 0.4154 | 0.4097 | **0.3940** ✓ |

Lectura (RELATIVA, misma referencia por medición — los absolutos incluyen la inestabilidad del propio OCR):

1. **natural gana en ambas** — es el único modo SIN CLAHE (solo remoción de sombras + white-point): el mejor para OCR en papel arrugado.
2. **gray es el peor de la medición 1 (0.648)** — CLAHE a plena potencia amplifica las arrugas hasta generar estructura falsa (847 chars hipótesis vs 634 de referencia: el OCR alucina). Es exactamente el riesgo que §F5 temía ("si CLAHE agresivo sube el CER en papel satinado, lo sabes con número") — confirmado con números en papel arrugado.
3. **color (CLAHE solo en canal L) queda a medio camino**; **bw (Sauvola, sin CLAHE) sobrevive** y además es el modo más barato (112KB/página).

**Implicación de producto** (registro, no cambio de código en F6.5): para papel arrugado/satinado recomendar `natural` como modo por defecto del usuario; revisar parámetros CLAHE (clip 2.0 → menor, tiles mayores, o CLAHE condicionado a papel plano) como trabajo futuro.

## 6. Hallazgos → acciones (F6.5)

| # | Hallazgo | Acción tomada | Estado |
|---|---|---|---|
| H1 | Sin editor de quad en f5 (pg3-ruido quedó en el PDF) | editor de F4 portado a f5 (mismo contrato FSM) | ✅ código + E2E |
| H2 | PDF 5.28MB/3págs > DoD 3MB | export adaptativo `pdfBudgetBytes` + `EXPORT_STEPS` (worker: `quality`/`maxLongSide` aditivos); E2E real 4.17MB → 2.04MB | ✅ código + E2E |
| H3 | Las miniaturas no reflejaban el modo (confusión "solo se ve al exportar") | thumbs renderizadas con el modo vigente (cache + fallback); tag = modo visible | ✅ código + E2E |
| H4 | Banding CLAHE confirmado (D-F5-b) | registro + recomendación de modo; tuning CLAHE = trabajo futuro | 📝 documentado |
| H5 | Protocolo CER: referencia = OCR de la última captura (diseño); exige captura legible | aclaración en este reporte; repetir con documento plano/legible | 📝 documentado |

Validación de la regresión F6.5: vitest 363/363 · tsc limpio · E2E F6.5 6/6 (con opencv REAL vendor — el stub de cv rompe el warp) · F6.1 2/2 · F6.2 3/3.
