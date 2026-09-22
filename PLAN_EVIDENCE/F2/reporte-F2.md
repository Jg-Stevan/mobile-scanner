# Evidencia F2 — ScanOrchestrator: score en vivo + burst-rank + manual

Fecha: 2026-09-22 · Precondición: F1-CLOSE en baseline (`d6f850f`).

## Implementación (solo `src/scan/` + `src/ui/ScoreView.ts`, sin tocar aprobados)
- `scoring.ts` (puro): luminancia BT.601 → hist + Var(Laplacian) 3×3 +
  bandas under/over + `selectHint` (1 mensaje, prioridad literal del spec).
  Umbrales de copy DARK/BRIGHT 0.25 marcados como NO-calidad.
- `ScanOrchestrator.ts`: FSM idle→detecting→capturing→revalidating→captured
  (+cooldown 1.5s) · score por result (sharp/exp/stab/ecc×multiplicativa,
  isBlur con varianza cruda) · racha 300ms>0.8 → burst · timeout 8s re-armado.
  Burst: 2 frames + takePhoto secuencial; revalidación a 400-clase sobre frame
  completo (desviación documentada: F3 aún no re-detecta); pass = lapVar≥100
  (BLUR aprobado) + exposición≥0.5 (REVAL_MIN_EXPOSURE_SCORE, ingeniería F2);
  gana takePhoto si pasa, si no el mejor frame; perdedores cerrados al instante;
  ganador CRUDO + quad prior + ruta. Manual funciona sin quad. Cooldown + vibrate/
  flash por plataforma. Sin setInterval.
- `ScoreView.ts`: anillo (verde≥0.8/amarillo≥0.5/rojo) + % + hint en canvas.
- Desviación estructural documentada: el histograma de exposición se muestrea
  en main thread (~160px) porque el protocolo F1 no lo trae y pipeline es
  intocable — consistente con la de revalidación.

## Verificación
- Unit: 151/151 (26 nuevos F2: FSM/racha/timeout/ranking/retry/cooldown/
  manual-null/exposure-fallback/ecc-hint + defaults DOM + scoring + ring).
  tsc limpio. Cobertura: scoring/scoreView 100%.
- E2E sintético (fuente canvas.captureStream — la fake cam da lapVar ~65 y
  NUNCA dispararía; papel CON TEXTO exigido por el spec):
  - sharp: **auto dispara 11×**, ruta A, reval ~3430, 0 retries/timeouts,
    mem −0.32MB. `e2e-sharp.json/png`.
  - blur: NO auto (score 0.24-0.29, timeouts) + **manual → retry** → detecting
    sin congelar. `e2e-blur.json/png`.
  - noquad: NO auto (7 timeouts) + **manual → captured quadNull:true**
    (reval 195.9). `e2e-noquad.json/png`.
- Hallazgo E2E (documentado, no escondido): texto que TOCA el borde del papel
  deforma el contorno exterior y rompe la detección (barras a x=150=borde).
  Escena corregida con margen ≥30px → dispara. Insumo para F4 (tolerancia de
  contacto en bordes) — el detector real con texto pegado al borde es caso F4/F6.

## ⏳ PENDIENTE HUMANO (papel CON TEXTO impreso, ambos dispositivos)
- Fase 0-empírica: ¿dispara solo <2s con documento nítido? ¿no dispara al
  mover? → umbrales VALIDADOS (sin recalibrar) o proceso de calibración.
- Flujo: vibra/flash → thumbnail → cooldown → re-disparo; manual sin quad.
- Screenshots → completar esta evidencia.

## Prohibiciones respetadas
- Sin warp/recorte (cruda + prior). quality.ts intacto (umbrales consumidos).
  Main thread sin decodificación bloqueante (async). Sin suavizado. Sin tocar
  core/, spike.html, tests/bench/, pipeline. Sin setInterval.
