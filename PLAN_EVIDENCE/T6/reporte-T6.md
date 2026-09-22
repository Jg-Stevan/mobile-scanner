# Evidencia T6 — Cierre del spike: decisiones 1-3, D5/D6, matriz + push

Fecha: 2026-09-22 · Precondición: T5 en baseline (`fb5a577`).

## Fase 1 — Registro (docs de gobierno, sin tocar src/)
- WORKFLOW_STATE → Desviaciones: **D5** (grupos virtuales iOS, track idéntico
  2160×3840, lente = zoom), **D6** (sin focusMode en iOS → fallback + heurística
  por label), actualización takePhoto-iOS (existe, 0/5 fallos, 227-426ms, sin
  boost == track). Matriz de dispositivos CONGELADA + decisiones 1-3 cerradas.
  Spike humano → COMPLETADO (pendiente menor: toggle torch iOS).
- PLAN_MAESTRO → §4: nota iPhone (4K, takePhoto sin boost, convergencia ~309 DPI
  tras cap). §5-F0: checklist marcado [x] con valores medidos.

## Fase 2 — Deploy (hallazgo de proceso cerrado)
- `git push origin main`: 6 commits (5ee7979..fb5a577) → `main -> main`, en sync.
- Pages verificado post-push (Last-Modified 2026-09-22 00:08 UTC):
  contenido HTTP con `map(r => [r.k, r.v])` + "el cap aplica al warp final" ✓
  (los dos marcadores T1-R4 ausentes en el deploy viejo).
- E2E público (fake cam 640×480): capabilities raw POBLADO ✓.
  `spike-pages-postT1R4.png`.

## Prohibiciones respetadas
- Sin tocar src/, spike.html, tests/bench/. Solo docs + push + evidencia.
