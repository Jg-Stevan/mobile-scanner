# DOSSIER DE PROYECTO — mobile-scanner

> **Propósito de este archivo:** briefing autocontenido para una IA que trabaja DESDE EL NAVEGADOR y no tiene acceso al disco del humano. Todo lo que necesitas está aquí dentro — no hay referencias externas que puedas leer. Si el humano te pega o sube este archivo, este es tu contexto completo.
> **Última actualización del dossier: 2026-09-24**

---

## 1. Qué es el proyecto

**Digitalizador de documentos 100% web, cliente-side** (sin servidor): convierte un teléfono con navegador en un escáner de documentos. Pipeline: captura de cámara → detección automática de bordes del papel → recorte por homografía (warp) → mejora de imagen (4 modos) → PDF multipágina exportable.

**Objetivo principal:** máxima precisión en captura y recorte automático + alta calidad del documento final.

**Éxito medible:**
- Corner error ±X mm al 95% (medido con diana física impresa, no abstracto)
- IoU ≥ 0.95 por condición en set congelado propio
- < 15% de capturas requieren ajuste manual
- DPI efectivo medido en runtime por captura (nunca prometido por plataforma)

**No-Goals explícitos del MVP (decisiones documentadas, NO re-discutir):**
- Dewarping 3D (DewarpNet/DocTr/UVDoc) — la homografía plana cubre documentos planos
- OCR en producción client-side (Tesseract.js solo como harness de medición CER en pruebas)
- Compresión MRC/JBIG2
- Warp en WebGL

**Stack:** Vite + TypeScript strict (Node 24) · OpenCV.js WASM 4.5.5 SOLO dentro de Web Worker · Vitest (`npm test`, 314 tests) · pdf-lib para PDF · IndexedDB (fflate para ZIP) · UI vanilla TS.

**Estado del plan maestro:** v3.1 CONGELADO. Los agentes NO re-discuten decisiones; proponen cambios por escrito, nunca inline.

## 2. Cómo trabajamos (proceso y organización)

- **Flujo de orquestación:** orquestador → explorador → implementador-backend → revisor + revisor-b (doble revisión con votación en `/ship`; desacuerdo → el orquestador juzga).
- **Prefijos de tarea:** `[CONSULT]` = diagnóstico sin editar código · `[DELEGATE]` = cambios autorizados.
- **División agente/humano (CRÍTICA):**
  - Agentes: código, tests, estructura, harnesses, docs, HTML de instrumentos.
  - **SOLO el humano:** validación en dispositivos físicos reales (getUserMedia), llenado de checklists del spike, tabla DPI por dispositivo. Una IA nunca declara "validado en dispositivo".
- **Cada tarea cierra con:** tests verdes + `npx tsc --noEmit` limpio + reporte de evidencia en `PLAN_EVIDENCE/<tarea>/reporte-<tarea>.md` (fecha, commit base, cambios, verificación, pendientes humanos, prohibiciones respetadas).
- **Órdenes de trabajo** se documentan en `TAREAS/` (las ya ejecutadas van a `TAREAS/archivo/`).

## 3. Reglas de oro (violar = CHANGES_REQUESTED)

1. **Memoria WASM:** TODO `cv.Mat` vive dentro del wrapper `withMats()` con `.delete()` en `finally`. Tras cualquier cambio en el worker: test de estrés de 10 minutos (0 leaks, heap estable).
2. **Coordenadas:** PROHIBIDO hardcodear aspect ratios (4:3/16:9) — el video es un crop del sensor con ratio distinto a la foto; los valores reales vienen del `CameraProfile` del spike (matriz de dispositivos abajo).
3. **Umbrales de calidad** (score 0.8, ventana 300ms, bandas del refiner): constantes con origen documentado en `src/core/` — un agente no los inventa ni los "afina" sin datos de captura.
4. **Cap de resolución:** lado largo de salida ~3500px (~309 DPI en carta). Prohibido operar 12MP completo en el hilo principal.
5. **`src/core/` no toca DOM** → testeable en Node con el mismo código que producción.
6. **Carpetas prohibidas:** `tests/bench/` (set congelado de evaluación — jamás usar para ajustar el detector, evita fuga de evaluación) y `PLAN_EVIDENCE/` (solo escritura de reportes de evidencia).
7. **Física aceptada, NO perseguir:** distorsión de lente de barril, techo 1-2px CDE en esquinas extremas. Cuando se llega al techo, es la lente — no perder semanas de código.
8. **Higiene de deploy:** al reconstruir un harness, conservar al menos una generación previa de sus assets hasheados (los HTML cacheados pueden pedir el bundle anterior).

## 4. Estado al corte (2026-09-24)

| Fase | Contenido | Estado |
|---|---|---|
| F0 | Spike de dispositivos + CameraProfile + 3 rutas de captura | ✅ COMPLETADA (SM-A566E + iPhone 17 Pro, 2026-09-22) |
| F1 | Detección de bordes en vivo (QuadDetector, overlay, estrés) | ✅ COMPLETADA (2026-09-22, validada en 2 dispositivos) |
| F2 | Score de calidad + auto-shutter (burst-rank, k-de-n) | ✅ COMPLETADA (2026-09-22, re-test humano aprobado) |
| F3 | Captura hi-res + re-detección + CornerRefiner + warp (CRÍTICA) | ✅ COMPLETADA (2026-09-23, código + 2 dispositivos) |
| F4 | Editor de esquinas + colector de dataset + diana de calibración | 🟡 Código cerrado (248/248 tests, 2026-09-24) — **falta validación humana en dispositivo** (edición táctil + colector + diana) |
| F5 | Multipágina + 4 modos de imagen + PDF | 🟡 En curso (314/314 tests, PDF E2E 5 págs <1MB, estrés 10min limpio) — falta revisión visual humana (banding CLAHE) |
| F6 | PWA + telemetría (Sentry) + endurecimiento | ⚪ No iniciada |
| F6.5 | Modelo ONNX (YOLOv8n-pose) | ⚪ Condicional: solo si telemetría post-MVP muestra >15% ajustes manuales |

**Números actuales:** 314/314 tests verdes · tsc limpio · estrés 10 min 0 errores (heap 12.45→12.14MB en Node) · applyMode Node 2040×2640: Color 1.49s / Gris 1.01s / B-N 1.36s / Natural 1.19s · PDF 5 páginas = 907KB (<8MB DoD).

## 5. Decisiones y desviaciones clave (resumen ejecutivo)

| ID | Decisión |
|---|---|
| D1 | Formato de referencia: **CARTA** (8.5×11 in), no A4. A4 queda como alternativa. |
| D2 | La orientación del teléfono afecta el DPI en documentos portrait (vertical ≈254 DPI vs horizontal ≈196). |
| D3 | Selección de cámara Android: por `focusMode` (autofocus real), no por `facingMode`. |
| D4 | La ruta C (`input capture`) ignora el deviceId; siempre usa la cámara principal nativa. |
| D5 | iOS expone grupos virtuales de dispositivos, no lentes individuales; control fino = constraint de zoom. |
| D6 | iOS no expone `focusMode` → fallback: heurística por label ("Cámara trasera" simple; descartar ultra-wide/tele). |
| D7 | Umbral FPS detección ≥15 → **≥12 sostenido** (p95 <100ms y fluidez visual confirmada por humano). |
| D8 | Proceso a 300px RECHAZADO: precisión > fluidez en documentos densos; el botón manual cubre el extremo. |
| D-F5 | OpenCV.js 4.5.5 no expone `createCLAHE` → los 4 modos se implementan en JS puro dentro del worker, Node-testeable. |
| D-F5-b | CLAHE usa LUT de celda sin interpolación bilineal (budget); banding pendiente de CER + revisión visual. |

**Hallazgo clave (limitación F1):** papel sobre fondo CLARO (blanco-sobre-blanco) NO se detecta — caso registrado del plan. Escape = botón manual SIEMPRE visible; solución definitiva = F6.5 condicional. No se "arregla" con trampa de umbrales.

## 6. Matriz de dispositivos (congelada 2026-09-21)

| Ruta | Android SM-A566E | iPhone 17 Pro |
|---|---|---|
| Track (preview) | 2160×3840 · 254 DPI teórico · medido 206-225 | 2160×3840 · medido 209-223 |
| Auto takePhoto | 3060×4080 (boost) · ~940ms · ~240 DPI natural | 2160×3840 (sin boost) · 227-426ms · == ruta B |
| Auto drawImage | 2160×3840 | 2160×3840 |
| Manual input | 6120×8160 (50MP) · ~309 DPI tras cap | 3024×4032 · ~309 DPI tras cap |
| EXIF from-image | ✓ Chrome | ✓ Safari |
| Torch | ✓ funcional | capabilities ✓ |
| Selección de cámara | D3 por focusMode | D6 por label |
| Multipage input | 1 foto/gesto | 1 foto/gesto |

Ambos dispositivos convergen a ~309 DPI tras el cap de 3500px: el cap normaliza la salida independiente del sensor.

## 7. Arquitectura (mental model)

```
Hilo Principal                    Web Worker (OpenCV.js WASM)
─────────────────                 ───────────────────────────
CameraController (D3/D6)    ──►   QuadDetector (400px clase,
Video preview (contain)           Canny+contornos+approxPolyDP)
OverlayCanvas (polígono)          ─► CornerRefiner (bandas adapta-
ScanOrchestrator (FSM:              tivas + fitLineTrimmed + RANSAC,
  idle→detecting→capturing          validación post-refine, fallback
  →revalidating→editing)            por lado)
AdjustEditor (loupe 3×)           ─► warpPerspective INTER_CUBIC
PageGallery + PageStore             + unsharp 0.5/1.5 (cap 3500px)
IndexedDB (storage.persist)       ─► enhance JS 4 modos (D-F5)
pdfExport (pdf-lib, Letter/A4)    ─► {corners, score, refined} de vuelta
```

**Protocolo worker:** `{type:'detect', bitmap}` transferable → `{type:'result', corners, score}`. Backpressure: frames descartados si el worker está ocupado.

**Score de calidad (F2):** `0.4·nitidez + 0.3·exposición + 0.3·estabilidad`, × excentricidad (multiplicativa). Disparo: score >0.8 sostenido 300ms → burst-rank con re-validación. Escapes: botón manual SIEMPRE visible + timeout 8s.

**Los 4 modos (F5):** Color (sombras+CLAHE L) · Gris (sombras+CLAHE luminancia) · B/N (Sauvola ventana por DPI → PNG) · Natural (solo sombras, sin CLAHE).

## 8. Mapa del repositorio (contexto — no puedes leerlo, pero el humano sí)

```
mobile-scanner/
├── src/core/          # Lógica pura sin DOM (geometry, quality, types, dianaMath, imageModes)
├── src/workers/       # detection.worker + pipeline + protocolo + withMats + enhanceJs
├── src/camera/        # CameraController, frameLoop, hiResCapture (rutas A/B/C)
├── src/scan/          # ScanOrchestrator (FSM), cornerRefiner
├── src/ui/            # ScannerView, ScoreView, AdjustEditor, PageGallery
├── src/export/        # pdfExport, pageStore (IndexedDB), datasetStore
├── tests/             # Vitest (314 tests) — tests/bench/ INTOCABLE
├── scripts/           # gen-fixtures.mjs, gen-diana.mjs (diana Carta 300 DPI)
├── harnesses/         # FUENTES de los instrumentos de validación
│   ├── spike.html                   # spike F0 (diagnóstico de dispositivo)
│   └── test-harness-f{2..5}device.html  # harnesses de validación humana
├── f1..f5/            # BUILDS desplegados en GitHub Pages (assets hasheados,
│                      #   regla anti-cache — NO mover ni borrar assets viejos)
├── TAREAS/            # Órdenes de trabajo vigentes (archivo/ = ejecutadas)
├── PLAN_EVIDENCE/     # Reportes de evidencia por tarea (solo escritura)
├── PLAN_MAESTRO.md    # Plan v3.1 congelado (fuente de verdad de decisiones)
├── WORKFLOW_STATE.md  # Bitácora viva de tareas/decisiones/desviaciones
├── AGENTS.md          # Contrato de conducta de agentes
└── DOSSIER-IA.md      # Este archivo
```

## 9. Pendientes actuales (por si te toca trabajar)

1. **F4:** validación humana en dispositivo físico (edición táctil de esquinas + loupe, colector de dataset opt-in, diana de calibración ±X mm al 95%) — solo el humano puede.
2. **F5:** revisión visual humana del banding CLAHE (D-F5-b) + harness CER Tesseract.
3. **F6 (siguiente fase):** PWA (manifest + Workbox, cachear opencv.js 8MB), telemetría Sentry, endurecimiento de errores (permisos, rotación, background).
4. Backlog: build custom OpenCV (~2-3MB solo imgproc) pre-producción.

## 10. Changelog del dossier

- **2026-09-25:** fix harness F4 (F4-fix-arranque): boot recuperable con botón
  "Iniciar cámara" + error visible + reintento (patrón F5). Hallazgo de
  infraestructura: docs.opencv.org responde 403 challenge Cloudflare a
  `importScripts` en algunos contextos → fragilidad documentada con propuesta
  de vendorizar opencv.js 4.5.5 en el repo para F6/PWA. Estado: sin cambios de
  fases (F4/F5 siguen en curso, pendiente humano).
- **2026-09-24:** creación del dossier. Corte: F4 código cerrado pendiente humano, F5 en curso (314/314).

**Regla de mantenimiento:** cada cierre de tarea o /ship actualiza las secciones 4 (Estado) y 10 (Changelog). El resto cambia solo si hay decisión nueva de arquitectura.
