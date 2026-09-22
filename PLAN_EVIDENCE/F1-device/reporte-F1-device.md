# Evidencia F1-device — Deploy del harness F1 en /f1/ para validación humana

Fecha: 2026-09-22 · Precondición: F1 código en baseline (`f1bdcef`).
Acción previa: limitación fixture-b registrada en WORKFLOW_STATE (blanco-sobre-
blanco → escape manual F2, solución F6.5).

## Deploy
- `test-harness-f1.html` recreado (idéntico al verificado + rejilla de métricas
  en pantalla FPS/latencia/quad/hint para el test humano; live 60s).
- Build prod con `base: './'` (TEMPORAL, borrado tras el deploy): con base
  absoluta los assets iban a `/assets` y rompían bajo subpath (404 verificado
  antes del fix). Bundle servido en `f1/` (commiteado: html + 2 JS con hash,
  ~11KB; OpenCV por CDN, no vendored).
- Verificado local en `/f1/`: worker relativo carga, detección correcta
  (gtErr 0.0024), overlay verde + hint D2, métricas fluyen. `f1-harness-f1-path.png`.
- Nota: en tab background el rAF se trottlea (~1fps fuente; worker al día con
  todo lo enviado, 0 backlog). En primer plano (teléfonos) va a tasa completa
  (14.6 FPS medidos en F1). No es defecto del bundle.

## Adjudicación /ship (revisor APROBADO vs revisor-b 1 finding)
- Finding (`aspect-ratio: 4/3` en el CSS del harness): ACATADO aunque la
  matemática nunca lo usaba (todo de dims runtime) — la regla es absoluta y el
  fix era trivial: CSS sin aspect, overlay sigue al rect real del video vía
  `resize()`. Rebuild verificado (worker hash idéntico → cambio solo-layout;
  overlay + hint OK en `f1-harness-no-aspectratio.png`).
- Veredicto final: APROBADO.

## URL para el humano
`https://jg-stevan.github.io/mobile-scanner/f1/test-harness-f1.html?autostart=1&mode=live`
- SM-A566E: FPS/latencia en pantalla (≥15 / <100ms) · polígono verde ·
  girar a landscape → hint D2 · screenshot. (Cierra también T5 implícitamente.)
- iPhone: lo mismo en Safari + toggle Torch (5 seg).

## Limpieza
- Temporales borrados: test-harness-f1.html, vite.f1deploy.config.ts, dist-f1/.
  Commiteado: `f1/` (artefacto de deploy) + WORKFLOW_STATE (limitación b).
- Sin tocar src/, tests/, skills.
