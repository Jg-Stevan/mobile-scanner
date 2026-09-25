# Evidencia F4-validacion (ronda 1) — hallazgos humanos + fixes del editor

Fecha: 2026-09-25 · Base: `ae96caf` (F4-fix-typo-editBtn pusheado y verificado por
el humano: "bien volvió a la normalidad el disparo y captura automática").

Dispositivo: SM-A566E (Android, Chrome) — igual matriz que ronda previa.

## Hallazgos del humano (ronda 1 de validación F4)

1. **Lupa bajo el dedo (UX):** "la lupa funciona correctamente pero es incómodo
   ver debajo del dedo — podríamos hacer que aparezca en el lado opuesto".
2. **"Circulitos de alto/ancho no funcionan; los de esquinas sí":** los círculos
   de punto-medio NO eran handles — eran badges de estado del CornerRefiner
   (ámbar = lado caído a fallback). Con `fellBack=null` (captura manual sin
   refine) se dibujaban los 4 en ámbar → parecía un control roto.
3. **Confirmar muerto en captura manual (BUG):** captura sin recorte automático
   → editar → confirmar = sin efecto. En captura automática confirmaba bien.
4. **Diana:** pregunta — ¿tiene que estar bien negra? (impresión poco densa).
   Resultados enviados como imágenes + ZIP (NO llegaron al sandbox — gateway
   de adjuntos falla sistemáticamente: RAR, videos, imágenes/ZIP).

## Diagnóstico (código + repro Playwright del artefacto f4/)

### Hallazgo 3 (el grave): cadena completa reproducida por lectura + E2E
- `#editorRoot` es `position:fixed; inset:0; z-index:50` (cubre TODO el
  viewport); `#toast` es estático en el flujo de la página → **cualquier toast
  disparado con el editor abierto se pinta DEBAJO del overlay → invisible**.
- En captura manual el quad inicial del editor = default 20% (no el documento)
  → hay que arrastrar las 4 esquinas mucho más que en auto → alta probabilidad
  de quad cruzado/colapsado al soltar → `validateQuad` → `'invalid'` → toast
  invisible → editor abierto, "confirmar no hace nada", cero feedback.
- Además `onConfirm`/`onRevert` no tenían `.catch()` → una rejection era 100%
  silenciosa.
- En auto el quad ya encaja → confirm directo sin arrastre → válido → cierra.
- REPRO E2E: captura forzada sin quad (`detectPhoto→null`, revalidate pass) +
  drag TL cruzando BR → confirm NO cerraba. Con el fix de feedback el mismo
  escenario muestra banner + error y el flujo completo pasa (ver Verificación).

### Hallazgo 2: por diseño del badge, no handle
`sideReviewBadges(fellBack)` con `null` devolvía `[true,true,true,true]`
("desconocido → revisar") y el render los pintaba SIEMPRE → 4 círculos ámbar
numerados en puntos medios = parecen 4 handles extra. El plan F4 solo pide 4
esquinas arrastrables.

### Hallazgo 1: posición de la lupa
`loupeRect` centraba la lupa EN el handle = bajo el dedo (el handle sigue al
puntero). Imposible ver el punto de corte con precisión en táctil.

## Fixes

### `src/ui/AdjustEditor.ts` (componente F4 en validación)
1. **Validación EN VIVO dentro del editor:** `quadIsValid()` (validateQuad de
   core/geometry sobre las fracciones actuales) → polígono ROJO (#ef4444, 3px)
   + banner rojo en el canvas "Quad inválido: esquinas cruzadas o lados
   degenerados — corrígelo antes de confirmar" cuando no es confirmable. El
   feedback vive DENTRO del overlay, visible siempre, en vivo al arrastrar.
2. **Lupa al lado opuesto del dedo:** nueva función pura `loupeCenter()` —
   dibuja el círculo en el lado VERTICAL opuesto (arriba por defecto; abajo si
   no cabe), X clampeada al canvas; la FUENTE sigue centrada en el handle → el
   crosshair marca el punto de corte real. `loupeRect` se conserva (tests).
3. **Badges solo con info real:** se dibujan SOLO si `fellBack !== null` (con
   captura manual / sin refine NO se pintan). `sideReviewBadges` sin cambios
   (tests intactos); cambia solo el render.

### `harnesses/test-harness-f4device.html`
4. **`#editorErr`** dentro del overlay (CSS nuevo) — espeja 'invalid'/'busy' y
   errores de promesa; se limpia al abrir el editor y al confirmar OK.
5. **`.catch()`** en submitEditedQuad/revertEditedQuad → showErr + #editorErr.
6. 'invalid' ahora explica la causa ("cruce/área/lados — corrige las esquinas
   rojas"); revert sin auto-quad (captura manual) ahora explica que ajuste y
   confirme (antes: toast invisible).
7. Texto de ayuda del editor actualizado (lupa opuesta + badges condicionales).

## Verificación
- `npm test`: 314/314 ✓ · `tsc --noEmit`: limpio ✓
- Rebuild `f4/`: bundle `Cd1nBD7V`, worker `DU2EpkNr` estable, generación previa
  conservada (higiene regla 8), config temporal borrada.
- E2E del ARTEFACTO (scripts/test-f4-editor-fixes.mjs, cámara fake + stub
  opencv + captura forzada sin quad):
  1. boot → shutter activo ✓
  2. captura manual sin quad → 'captured' ✓
  3. editor abre con default 20% ✓
  4. drag TL cruzando BR → banner rojo detectado por píxel ✓ (screenshot
     `e2e-editor-invalid-banner.png`: banner + lupa arriba + polígono rojo)
  5. confirm inválido → editor PERMANECE abierto + `#editorErr` visible ✓
     (antes: silencio total)
  6. drag de vuelta a válido → banner desaparece (validación en vivo) ✓
  7. confirm válido → editor CIERRA ✓ (el caso del humano, ahora OK)
  8. 0 pageerrors en todo el flujo ✓

## Pendientes humanos (ronda 2)
1. Aplicar parche + push + retest del editor en dispositivo (los 3 hallazgos).
2. Diana: reportar el TEXTO del indicador (los adjuntos no llegan): la línea
   `±X.XX mm al 95% (N; ancho Y mm)` + el ancho medido con regla. La impresión
   NO necesita ser negra intensa: importa contraste del borde, impresión a
   ESCALA REAL 100%, sin brillo/reflejos y buena luz al capturar.
3. Colector: contador final y si el ZIP abrió con manifest.jsonl + photos/.

## Prohibiciones respetadas
Sin cambios en `src/core/` (validateQuad solo IMPORTADO), umbrales ni
decisiones congeladas; `sideReviewBadges`/`loupeRect` intactos (compat tests);
`tests/bench/` intocado; CDN/versión opencv 4.5.5 intacta.
