# Evidencia T1-R4 — Registro de hallazgos del spike + fix del instrumento

Fecha: 2026-09-21 · Precondición: baseline `5ee7979` (T2-core + cierres T1-R2/R3) limpio antes del diff.

## Fase 1 — Hallazgos registrados (docs de gobierno)
- `WORKFLOW_STATE.md` → "Desviaciones Documentadas": D2 (orientación afecta DPI
  portrait: vertical ~254 vs horizontal ~196), D3 (selección por focusMode
  continuous/single-shot; ultra-wide sin AF/torch descartada), D4 (ruta C ignora
  deviceId; 6120×8160 con ambas), corrección de expectativa §4 (takePhoto natural
  ≈ 220-240 DPI, no ~353; video SM-A566E 225 DPI @ 88.6% encuadre).
- `PLAN_MAESTRO.md` → §4: nota de medición real SM-A566E bajo la tabla (tabla
  intacta, es referencia) + confirmación de re-detección F3 por hardware.
- `PLAN_MAESTRO.md` → §8: CameraController anota "selección de cámara por
  focusMode (D3)".

## Fase 2 — Fix del instrumento (spike.html, 2 líneas)
1. `Object.fromEntries(capRows.slice(0,8))` → `...slice(0,8).map(r => [r.k, r.v])`.
   Causa raíz verificada en Node (`check-fromentries.cjs`): `fromEntries` lee las
   props numéricas `"0"`/`"1"` de cada entrada (no itera); con `{k,v}` ambas son
   `undefined` → `{"undefined":undefined}` → `JSON.stringify` → `"{}"`. No
   lanzaba, solo vaciaba el panel.
2. Texto del cap: `⚠ ... superado ... anotar` → `ℹ track long side Xpx > cap de
   salida 3500px — normal; el cap aplica al warp final`.

## Verificación (cámara fake 640×480, Chromium MCP, `http://localhost:8130/spike.html`)
- Panel `capabilities raw` POBLADO (pre-fix: `{}`):
  `{"brightness":"{...}",...,"width":"{\"max\":640,\"min\":1}"}` (8 primeras caps,
  ver `cameraProfileLog.txt`).
- Screenshot: `spike-capraw-fix.png`.
- `npm test` 20/20 + `tsc --noEmit` limpio (sin cambios en `src/`, sin regresión).

## Prohibiciones respetadas
- Sin toques a `src/`, `tests/bench/`, skills. Tabla §4 intacta (solo nota añadida).
