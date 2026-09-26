# Propuesta D-F5-c: set de filtros estilo Adobe Scan + editor no-bloqueante

**Fecha**: 2026-09-26 · **Origen**: petición humana con video de referencia
("quiero replicar.mp4" — flujo Adobe Scan) tras probar los harnesses f4/f5
desplegados en Pages. **Estado**: IMPLEMENTADA (aprobada por el humano en el
plan de la sesión; pendiente validación en dispositivos).

## Qué cambia (extensión de spec §F5)

### 1. Set de filtros (dropdown "Modo export")

| Antes (§F5) | Ahora (D-F5-c) | Clave |
|---|---|---|
| Color | **Color original** | `color` |
| Gris | **Escala de grises** | `gray` |
| B/N (Sauvola) | — RETIRADO — | `bw` (legado → `text` al cargar) |
| Natural | **Color automático** | `natural` |
| — | **Texto claro** (nuevo) | `text` |

Pipeline del modo `text` (JS puro, D-F5, sin cv.Mat): corrección de sombras
(modelo de iluminación reducido, piezas existentes) → estirado de punto blanco
**p80** (`TEXT_CLARO_WHITE_PCT`) → S-curve de contraste pivote 0.72 ganancia
1.35 (`TEXT_CLARO_PIVOT`/`TEXT_CLARO_CONTRAST`) aplicada por gain al RGBA
completo. **NO binarización**: conserva antialias (a diferencia del Sauvola
retirado). Mime JPEG (todos los modos ahora son JPEG; `enhanceMime` simplificado).

Constantes INICIALES de ingeniería, origen "petición humana 2026-09-26 + video
Adobe Scan"; **validar con CER Tesseract por modo + revisión visual humana
antes de congelar** (misma disciplina que §F5). El harness f5 ya corre el CER
con `text` en el loop.

Migración: páginas persistidas en IndexedDB con `mode:'bw'` cargan como
`'text'` (`normalizeEnhanceMode`, pageStore).

### 2. Editor: quad inválido DEJA de bloquear (petición humana textual)

- `submitEditedQuad` ya no devuelve `'invalid'`: quad válido → warp normal
  (`'ok'`); inválido (cruzado/degenerado/área<25%/lado<5%) → warp con el
  **bounding box** axis-aligned (`quadBoundingBox`), `needsEditorReview=true`,
  status `'fallback'`. Una captura trocida SIEMPRE se puede guardar.
- Banner del editor: "Quad inválido — se guardará el recuadro ajustado
  (bounding box)" (antes: "corrígelo antes de confirmar").

### 3. Snap a esquina de página en el recorte manual (petición humana)

- Al arrastrar un handle cerca de una esquina de la **detección automática**
  (`quadRefined ?? quad`), salta a ella (radio 4% del lado largo,
  `EDITOR_SNAP_RADIUS_FRACTION`); el handle se pinta verde al snapear.
- VIVO: sale del snap alejando el dedo (no requiere gesto extra).
- **Tras 3 gestos de arrastre se desactiva** para esa sesión del editor
  (`EDITOR_SNAP_MAX_GESTURES`): "si se modifica más de 3 veces por el usuario
  no insistir (puede que no esté alineado con lo que quiere)" — textual.
- Captura manual sin detección → sin targets → sin snap.

### 4. Fixes del editor

- **drawImage detached** (error "Confirm: Failed to execute 'drawImage'..."):
  causa raíz = aliasing de `ImageBitmap` en el harness f5 (`onEdited` cerraba
  `lastPhoto.bitmap` que la foto actualizada compartía por spread `{...p}`).
  Fix: solo cerrar bitmaps genuinamente supersedidos (comparación por
  identidad). + guard defensivo en `makePreview` con mensaje claro.
- **"Volver a auto" → "Detección automática"** (f4 y f5), mensajes ajustados.

## No-goals: sin conflicto

`text` es tone-mapping JS puro (misma familia que natural/color). No es OCR,
no es MRC, no es dewarping. Sin cv.Mat nuevos.

## Pendiente de validación humana (2 teléfonos)

1. Filtro **Texto claro** sobre documento real arrugado (el del video).
2. Snap de esquinas: naturalidad y que 3 gestos basten.
3. Guardar una captura trocida (quad inválido → bounding box) sin error.
4. Confirm/re-edit sin el error detached (f5).
5. CER por modo con `text` incluido → confirmar/ajustar las 3 constantes.
