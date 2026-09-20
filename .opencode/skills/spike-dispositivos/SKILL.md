---
name: spike-dispositivos
description: Use for the F0 device spike (dias 1-2): generating the diagnostic HTML instrument and interpreting the CameraProfile logs / DPI table results reported by the human. Agent generates instruments; ONLY a human executes on physical devices.
---

# Spike de Dispositivos (F0)

Fuente de verdad: PLAN_MAESTRO v3.0, sección 5 · F0 (Spike, días 1-2) y sección 4.

> 🚧 **REGLA DIVISIÓN AGENTE/HUMANO:** el agente genera instrumentos (HTML del spike, logs, plantillas). **SOLO un humano** ejecuta en dispositivos físicos reales (getUserMedia no se valida desde IDE ni BrowserStack) y reporta los resultados. Nadie "rellena" la checklist con supuestos.

## Objetivo del spike

Determinar fácticamente los valores que F1+ necesita: resolver de qué track dispone cada dispositivo, qué rutas de captura funcionan y las DPI reales. Sin estos datos, todo lo demás es suposición.

## Checklist del spike (el HTML del spike la expone en pantalla)

- [ ] `getSettings()` → ¿track 4K disponible en iOS moderno? (define la tabla de DPI real)
- [ ] `takePhoto()`: resolución, latencia, fallos por dispositivo
- [ ] iOS: ¿`<input capture>` permite 1 foto por gesto o varias? (define el flujo multipágina)
- [ ] `createImageBitmap(blob, { imageOrientation: 'from-image' })` en Safari
- [ ] Capabilities: `torch`, `focusMode`, teleobjetivo/lente principal (¿`enumerateDevices()` las lista?)

## Formato del CameraProfile log (mínimo)

```
deviceLabel          : <label de enumerateDevices>
track.width x height : ej. 1280x720
aspect ratio         : ej. 16:9 (NUNCA asumir; es un crop del sensor)
capabilities.torch   : true|false
capabilities.focusMode : continuous|manual|...
dpiRuntime           : anchoQuadPx / 8.27   (DPR del papel A4 en runtime, no prometido)
settings verificados : getSettings() real, no ideal
```

## Plantilla de tabla DPI por dispositivo (sección 4 del maestro)

| Dispositivo | Ruta | Resolución | DPI efectivo (A4 llenando encuadre) | Nota |
|---|---|---|---|---|
| (día 1) | A: takePhoto (Android) | 3000×4000 | ~360 | Ruta de calidad Android |
| (día 2) | B: drawImage track (iOS auto) | 1080 ancho | ~130-165 | Lectura/OCR ok; NO impresión |
| (día 2, si getSettings 4K) | B: drawImage track | 2160 ancho | ~260-330 | El spike lo determina por modelo |
| (día 2) | C: input capture (iOS manual) | Full sensor | ~300+ | Ruta de calidad iOS, UX primera clase |

## Flujo tras ejecución humana

1. El humano abre el HTML del spike en 2-3 dispositivos reales (incl. iPhone físico) y llena la checklist.
2. El humano reporta al orquestador el log de cada dispositivo.
3. El orquestador actualiza el `CameraProfile` y congela la tabla DPI real.
4. Recién entonces F0 construcción (CameraController etc.) avanza con datos reales.

## Referencias del maestro

- Sección 5 · F0: checklist de spike + tareas de construcción + DoD.
- Sección 4: tabla de números honestos y la consecuencia de diseño (copy no promete uniformidad).