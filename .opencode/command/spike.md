---
description: Spike F0 de dispositivos — genera el instrumento HTML de diagnóstico, recuerda que la ejecución es humana, y congela CameraProfile + tabla DPI con lo reportado.
---

Spike F0 (PLAN_MAESTRO sección 5 · F0). Usa la skill `spike-dispositivos`.

1. Genera/actualiza el HTML del spike F0 en `spike.html` (un solo archivo autocontenido, abrible directo sin build) con: selector de cámara principal trasera explícita via `enumerateDevices`, `getSettings()` reales, `getCapabilities()`, test de rutas A/B/C, test `createImageBitmap` con `imageOrientation:'from-image'`, y medición de DPI runtime (`anchoQuadPx / 8.5` — Carta, D1; A4 = 8.27 alternativa).
2. ⚠️ RECORDATORIO: la ejecución en dispositivos físicos es HUMANA (getUserMedia no se valida sin hardware; BrowserStack no sirve). El agente NO ejecuta ni rellena la checklist.
3. Cuando el humano reporte los logs por dispositivo, actualiza `CameraProfile` (src/camera/) y congela la tabla DPI real en el plan mañana/trabajo de F0. Nada de valores supuestos: si un dato no fue medido, queda pendiente.