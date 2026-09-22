# Evidencia F1-b — D6: heurística de selección iOS (código)

Fecha: 2026-09-22 · Precondición: F1-a en baseline (`d256530`).

## Cambio (SOLO `src/camera/CameraController.ts` + tests)
- Rama fallback de `chooseMainCamera` (sin AF, típico iOS): ANTES del sort por
  resolución, filtro D6 — `LENS_WORDS_RE` (/ultra|gran angular|wide|angular|
  tele|teleobjetivo/) descarta grupos no-principales; entre simples, MENOS
  palabras primero y resolución como desempate final.
- Refinamiento documentado sobre el spec: el spec pedía desempate por resolución
  entre simples, pero D5 probó que los grupos virtuales dan track idéntico →
  el sort por resolución es ciego; el conteo de palabras es la única señal real.
- Sin simples: label más corto + warning "sin grupo simple". D3 con AF intacta.

## Tests (4 nuevos, labels REALES del iPhone D5)
- 8 grupos, resoluciones ADVERSAS (ultra-wide con más píxeles) → elige
  "Cámara trasera" (simple). Sin ella → "dual". Sin simples → más corto +
  warning. Android con AF → D3 sin cambio.

## Verificación
- 124/124 tests (22 en cameraController) + tsc limpio.
- ⏳ Re-test humano iPhone pendiente: panel debe mostrar "Cámara trasera".

## Prohibiciones respetadas
- Solo CameraController + tests. Sin tocar core/, spike.html, tests/bench/.
