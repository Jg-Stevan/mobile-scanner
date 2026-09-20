# current_plan.md — [DELEGATE] Generar HTML del spike F0

**Estado:** IN PROGRESS (generación) → PENDIENTE ejecución humana

## Tarea (del plan de adaptación T3.3)
Generar el HTML del spike F0 según PLAN_MAESTRO §5-F0 y la skill `spike-dispositivos`:
un solo archivo autocontenido, abrible directo, con panel de diagnóstico en pantalla.

## Requisitos del entregable (T3.4/T3.5)
- a) Archivo único `spike.html`, sin build requerido.
- b) Veredictos A+B (revisión doble) sobre el diff.
- c) Este plan en current_plan.md.
- d) WORKFLOW_STATE.md actualizado ("F0 spike: instrumento generado, pendiente ejecución humana").
- T3.5) NO hardcodear valores que el spike debe medir (resoluciones de track, DPI); medir en runtime.

## Contenido requerido del instrumento
1. `enumerateDevices()` → listar cámaras, elegir la principal trasera explícita.
2. `<video playsinline muted>` + bucle rVFC con fallback rAF.
3. Panel de diagnóstico: `getSettings()` (W×H real, framerate, aspect), `getCapabilities()` (torch, focusMode, zoom…), log CameraProfile.
4. Test rutas A/B/C: takePhoto (resolución, latencia, fallos), drawImage track (B), input capture (C, ¿1 o varias fotos por gesto?).
5. EXIF Safari: `createImageBitmap(blob, {imageOrientation:'from-image'})`.
6. DPI runtime: quad manual sobre A4 + `anchoQuadPx / 8.27`.
7. Checklist del spike editable + exportación de reporte.

## Alcance del agente
Genera el instrumento. La ejecución y el llenado de resultados son humanos (F0 días 1-2).