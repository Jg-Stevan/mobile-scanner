# F6.3 — Telemetría opt-in (estilo Sentry) — evidencia

**Fecha:** 2026-09-25 · **Autor:** orquestador IA (sandbox) · **Base:** F6.2 (PWA offline) — patch apilado
**Plan §F6:** «Telemetría (Sentry): sin crash reporting ninguna métrica de aceptación es verificable en producción»

## Principios implementados (decisión documentada)

1. **OFF por defecto** — sin opt-in explícito NUNCA sale un byte del dispositivo
   (los eventos capturados viven y mueren en memoria; el panel lo dice: `local N`).
2. **Sin SDK por CDN** — lección F6.1: el SDK de Sentry por CDN sería otro SPOF.
   Se envía el formato **envelope oficial de Sentry** con un `send()` propio de
   ~10 líneas → apuntar un DSN real en el futuro funciona sin tocar este módulo.
3. **Privacidad por diseño** — solo mensajes de error/stack redactados + contadores.
   `redactMessage` quita query strings (`?token=…`), `blob:` y `file://`; la
   redacción se aplica DOS VECES (en captura y en el envelope — punto de salida).
   Jamás fotos, quads ni contenido de usuario.
4. **Rate limit anti-bucle** — máximo 20 envíos/sesión (TELEMETRY_MAX_EVENTS);
   los envíos FALLIDOS también cuentan (no martillear un endpoint muerto).
5. **DSN por configuración** — `localStorage mscan.telemetry.dsn`; vacío ⇒
   con opt-in se cuenta LOCALMENTE (útil para depurar en dispositivo) y no hay red.

## Qué se entregó

| Archivo | Contenido |
|---|---|
| `src/telemetry/telemetry.ts` | núcleo PURO (sin DOM/fetch — inyectados): parseDsn, redactMessage, buildEnvelope, createTelemetry (ring local, contadores, opt-in persistente) |
| `src/telemetry/harnessTelemetry.ts` | wiring DOM ligera (patrón proyecto): botón `#tBtn` OFF/ON + `#tStat` en el panel, hooks ADITIVOS `error`/`unhandledrejection` (no pisa los handlers de arranque), expone `window.__telemetry` (precedente `__orch`/`__editor`) |
| `harnesses/test-harness-{f4,f5}device.html` | `<div id="tMount">` + import + wire (2 líneas por harness) |
| `tests/telemetry.test.ts` | 11 tests unitarios (DSN, redacción, envelope, opt-in, rate limit, sin-DSN) |
| Rebuild f4/f5 + sw.js | versiones nuevas del artefacto (precache sigue en 11 entradas, hashes nuevos) |

## Verificación (sandbox)

**Unit:** vitest **330/330** (+11) · tsc limpio.

**E2E nueva `test-f63-telemetry.mjs` — PASS:**
1. **Default OFF:** boot completo sin interferencias → 2 capturas locales
   (incl. hook real de `window.error`) → **0 POSTs al endpoint**.
2. **Opt-in + DSN falso:** click → ON → envelope observado en el wire:
   header con `event_id` UUID, payload `platform:javascript / level:error`,
   mensaje presente con `?token=secreto` **REDACTADO**, header `x-sentry-auth`
   con la publicKey.
3. **Rate limit:** 26 capturas → exactamente 20 envíos + 6 descartados; POSTs
   observados = `snapshot().sent`. (Hallazgo del test: los envíos fallidos
   cuentan para el tope — comportamiento deseado anti-martilleo, documentado.)
4. **Persistencia:** reload mantiene ON; click apaga y persiste `mscan.telemetry.on=0`.

**Regresiones (todas verdes):** typo-fix ✓ · editor-fixes ✓ · stale-fellback ✓ ·
opencv-chain 2/2 ✓ · PWA offline 3/3 ✓.
Nota de entorno: los E2E f4 antiguos requieren servidor estático en :8477 con raíz
en `f4/` (el proceso zombi de rondas previas lo proveía; documentado en worklog).

## Para activar Sentry real (cuando exista cuenta)

1. Crear proyecto Sentry (plataforma JavaScript) → copiar DSN.
2. En el dispositivo: DevTools/remoto → `localStorage.setItem('mscan.telemetry.dsn','https://<pk>@<host>/<pid>')` → recargar → pulsar el botón de telemetría.
3. Los crashes del boot (`window.error`/`unhandledrejection`) llegan como eventos
   con release `mscan 0.1.0` — suficiente para las métricas de aceptación del §7.

## Fuera de alcance (siguiente)

- **F6.4** endurecimiento + matriz de dispositivos + checklist semanal
  (rotación, background, permisos revocados) + self-host de Tesseract CDN en f5
  (observación de esta ronda: el harness CER carga tesseract.js por jsdelivr —
  mismo patrón de riesgo que opencv pre-F6.1; solo afecta al harness, no al flujo).
- Panel de «nueva versión disponible» del PWA (MVP: aplica al siguiente reload).
