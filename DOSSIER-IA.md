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
| F4 | Editor de esquinas + colector de dataset + diana de calibración | ✅ COMPLETADA (2026-09-25, validada en SM-A566E + iPhone 17 Pro: editor con 3 adjustedQuad, colector 17/17 contrato, diana ±58.44/±23.99 mm al 95%) |
| F5 | Multipágina + 4 modos de imagen + PDF | 🟡 En curso (evidencia humana subida 2026-09-25 en PLAN_EVIDENCE/F5/validacion/ — veredicto externo pendiente; D-F5-c 2026-09-26 cambia el set de modos) |
| F6 | PWA + telemetría (Sentry) + endurecimiento | 🟡 Código completo y desplegado (F6.1..F6.4, 356→372 tests) — falta validación humana en dispositivo (PWA/pruebas A/B/checklist W) + DSN Sentry |
| F6.5 | Modelo ONNX (YOLOv8n-pose) | ⚪ Condicional: solo si telemetría post-MVP muestra >15% ajustes manuales |

**Números actuales (2026-09-26):** 372/372 tests verdes (D-F5-c incluida) · tsc limpio · estrés 10 min 0 errores · PDF 5 páginas = 907KB (<8MB DoD). Set de modos D-F5-c: Color original / Escala de grises / Color automático / Texto claro.

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
| D-F5-c | (2026-09-26, humano + video Adobe Scan) Set de filtros: Color original/Escala de grises/Color automático/Texto claro; `bw` retirado (legado→`text`). Modo `text` = sombras+p80+S-curve sin binarizar. Quad inválido no bloquea (bounding box); snap de esquinas (3 gestos); fix detached f5. |

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
IndexedDB (storage.persist)       ─► enhance JS 4 modos: color/gray/natural/text (D-F5+c)
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

1. **D-F5-c (2026-09-26) validación en dispositivo:** filtro Texto claro sobre documento arrugado · snap de esquinas · captura trocida guardable · confirm sin error detached · CER por modo (constantes `TEXT_CLARO_*` son iniciales hasta esto).
2. **F5 (paralelo):** revisión visual humana del banding CLAHE (D-F5-b) + veredicto del revisor externo sobre la evidencia de PLAN_EVIDENCE/F5/validacion/.
3. **F6:** código completo y desplegado (F6.1..F6.4 aplicados 2026-09-26) — falta validación en dispositivo (PWA/pruebas A/B/checklist W) + crear proyecto Sentry y compartir DSN.
4. Backlog: build custom OpenCV (~2-3MB solo imgproc) pre-producción · F6.5 ONNX (condicional a telemetría).

## 10. Changelog del dossier

- **2026-09-26 (8):** D-F5-c — set de filtros estilo Adobe Scan (petición humana
  con video de referencia): Color original / Escala de grises / Color
  automático / **Texto claro** (nuevo: sombras+p80+S-curve sin binarización,
  reemplaza al B/N Sauvola retirado; legado `bw` persistido carga como `text`).
  Editor: quad inválido DEJA de bloquear (warp con bounding box + status
  'fallback'), snap de esquinas a la detección automática (radio 4% lado
  largo, se apaga tras 3 gestos), fix del error detached-bitmap al confirmar
  en f5 (aliasing de ImageBitmap en onEdited), botón "Volver a auto" →
  "Detección automática". 372/372 tests, tsc limpio, harnesses+sw
  regenerados. Propuesta: PLAN_EVIDENCE/F5/propuesta-D-F5-c-texto-claro.md.

- **2026-09-26 (7):** F6.4 robustez de errores + matriz de dispositivos (cierra
  las filas restantes de §F6). `cameraErrors.ts` puro (clasificación por name y
  por mensaje → código/título/pista/retryable) + `CameraInitError` con `.code` y
  `.cause` (mensajes históricos intactos); init() conserva el error del
  desbloqueo (permiso denegado ya no se disfraza de "sin cámaras");
  `lifecycle.ts` (attachLifecycle + trackIsLive) y `extendDeadline()` en el
  orquestador (el tiempo en background no cuenta para el timeout de 8s);
  harnesses f4/f5: catch clasificado SOLO para errores de cámara — la cadena de
  candidatos de opencv pasa intacta (hallazgo de la regresión F6.1), pérdida de
  track = banner recuperable que re-adquiere SOLO la cámara sin reconstruir la
  app, `watchOrientation` (D2) conectado por fin; `docs/matriz-dispositivos.md`
  (matriz + checklist semanal W1-W11 + log de rondas). +26 unit (356/356, tsc
  limpio) + E2E 4/4 (permiso denegado, rotación, background, track ended) +
  regresión completa verde (7 suites E2E). Quirk headless documentado: denegación
  → NotSupportedError; el disparo real va en el checklist W4.
- **2026-09-26 (7):** F6.5 fixes de F5 por validación humana (editor f5 +
  export PDF adaptativo + thumbs con modo). Hallazgos con evidencia real del
  humano (actas E-14 arrugadas, lote 1/2 en `PLAN_EVIDENCE/F5/validacion/`):
  (1) f5 no tenía editor — una captura mala (warp de textura = página-ruido de
  1.9MB en el PDF) quedaba sin remedio → editor de F4 portado (mismo contrato
  FSM `openEditor`/`submitEditedQuad`/`cancel`). (2) PDF 5.28MB/3págs > DoD
  3MB → export ADAPTATIVO (`pdfBudgetBytes` + `EXPORT_STEPS` 2600/q0.82 →
  2200/q0.78; worker acepta `quality`/`maxLongSide` ADITIVO); E2E real:
  4.17MB → 2.04MB. (3) las thumbs no reflejaban el modo → re-render con
  cache + fallback. Hallazgo CER lote 2 registrado: **natural gana**
  (0.175/0.394) y **gray/CLAHE pierde** (0.648) en papel arrugado — la
  preocupación §F5 confirmada con números; bw sobrevive y es ~10× más
  barato. +7 unit (363/363, tsc limpio) + E2E 6/6 con opencv REAL (stub de
  cv rompe el warp: "e.Mat is not a constructor"). Regresión: F6.1 2/2,
  F6.2 3/3.
- **2026-09-25 (6):** F6.3 telemetría opt-in estilo Sentry. Núcleo puro
  (`parseDsn`/`redactMessage`/`buildEnvelope`/`createTelemetry`) + wiring DOM
  ligera (botón OFF/ON en el panel de f4/f5, hooks ADITIVOS de
  error/unhandledrejection, `window.__telemetry`). Desviaciones documentadas del
  plan: SIN SDK de Sentry por CDN (otro SPOF — lección F6.1) → se envía el
  formato envelope oficial con `send()` propio (~10 líneas); OFF POR DEFECTO —
  sin opt-in no sale un byte (E2E lo prueba con 0 POSTs); redacción doble de
  query strings/blob:/file: (jamás fotos ni quads); rate limit 20 envíos/sesión
  que cuenta también los fallidos (anti-martilleo, hallazgo de la E2E); DSN por
  localStorage — vacío ⇒ solo conteo local honesto. 11 tests unit (330/330) +
  E2E 4 casos + 6 regresiones verdes. Evidencia: `PLAN_EVIDENCE/F6/telemetry/`.
  Nota de ronda: los E2E f4 antiguos requieren servidor :8477 con raíz en f4/
  (antes lo proveía un proceso zombi — documentado). Siguiente: F6.4
  endurecimiento + self-host Tesseract del harness CER (mismo riesgo CDN).
- **2026-09-25 (5):** F6.2 PWA offline. Service worker hecho a mano (~120 líneas,
  desviación documentada del «Workbox» del plan: Workbox por CDN = otro SPOF tras
  F6.1) + manifest (start_url → harness F5, instalación standalone) + iconos
  maskable. `sw.js` generado por `scripts/build-sw.mjs` con precache calculado del
  artefacto (11 entradas: shells f4/f5 + bundles + workers + pdfExport + vendor
  opencv 8.6MB + manifest + iconos); navigate network-first→caché, resto
  cache-first→red; VERSION=sello de build con purga en activate. Registro
  inyectado post-build (build-harness-f4/f5.mjs) con guardas `sw-off`/`sw=1`/
  `webdriver` (aisla E2E con stubs sin editarlas). Rebuild f5/ además lleva la
  cadena F6.1 al worker desplegado de F5 (seguía pre-F6.1, dependía del CDN).
  E2E 3/3: instalación, **boot COMPLETO OFFLINE desde caché**, guarda; regresiones
  verdes (319/319, tsc, 4 E2E). Evidencia: `PLAN_EVIDENCE/F6/pwa/`. Estado: F6.1/F6.2
  esperan validación en dispositivo (instalable + modo avión).
- **2026-09-25 (4) — F4 CERRADA:** validación ronda 2 multi-dispositivo. Humano
  aplicó los 3 parches (typo editBtn + editor ronda 1 + fellBack stale;
  verificado byte-exacto en origin/main) y exportó 2 ZIPs del colector:
  Samsung 7 registros / iPhone 17 Pro 10 registros, 17/17 cumplen contrato
  DatasetEntry. 3 adjustedQuad PRIMEROS en dispositivo (2 edición clásica +
  1 recuperación manual TOTAL de un fondo-claro sin detección — el dataset
  registra el fallo del auto Y la corrección humana). Diana en vivo en 2
  plataformas: ±58.44 mm (N=5) y ±23.99 mm (N=7) al 95%, ancho 185 mm;
  dianaMath 13/13 tests en sandbox. iOS: orientación correcta (track apaisado
  3840×2160, fotos 900×1600 retrato, quads foto-relativos), camino nulo honesto
  (foto accidental del piso registrada sin detección). Lección: la regla
  "autoQuad null ⇒ fellBack null" era demasiado estricta — el re-warp del
  ajuste manual (submitEditedQuad→requestWarp) refresca la meta, fellBack
  pertenece al quad manual. Regla refinada en el analizador. Evidencia:
  PLAN_EVIDENCE/F4/colector/ronda2/ + reporte-colector-ronda2.md.
- **2026-09-25 (3):** F4 validación ronda 1: humano verifica arranque OK y
  reporta 3 hallazgos del editor. Fix del grave: "confirmar muerto" en captura
  manual = quad cruzado → 'invalid' con toast invisible bajo el overlay → ahora
  validación en vivo (borde rojo + banner) + #editorErr + .catch. Lupa al lado
  opuesto del dedo (loupeCenter). Badges de refine solo con info real. Rebuild
  f4/ (Cd1nBD7V), E2E del artefacto PASS, 314/314. Nota de infra: el gateway de
  adjuntos del sandbox falla sistemáticamente (RAR/videos/imágenes/ZIP) → la
  evidencia humana se reporta como texto. Estado: sin cambios de fases.
- **2026-09-25 (2):** fix harness F4 (F4-fix-typo-editBtn): causa raíz REAL del
  F4 muerto en dispositivo era un typo `$('#editBtn')` (getElementById con '#'
  → null → TypeError → main() moría antes del frameLoop y del handler del
  shutter). El diagnóstico previo (CDN 403) era válido como hallazgo de
  infraestructura pero NO era el causante: F5 usa el mismo worker/CDN y
  funciona en el dispositivo del humano. Fix de 1 carácter + rebuild f4/
  (bundle DW_MiY1r). E2E del artefacto con opencv stub: boot completo, shutter
  activo, 0 pageerrors. Lección registrada: la E2E anterior nunca ejercitó un
  boot COMPLETO hasta el final de main(). Estado: sin cambios de fases.
- **2026-09-25:** fix harness F4 (F4-fix-arranque): boot recuperable con botón
  "Iniciar cámara" + error visible + reintento (patrón F5). Hallazgo de
  infraestructura: docs.opencv.org responde 403 challenge Cloudflare a
  `importScripts` en algunos contextos → fragilidad documentada con propuesta
  de vendorizar opencv.js 4.5.5 en el repo para F6/PWA. Estado: sin cambios de
  fases (F4/F5 siguen en curso, pendiente humano).
- **2026-09-24:** creación del dossier. Corte: F4 código cerrado pendiente humano, F5 en curso (314/314).

**Regla de mantenimiento:** cada cierre de tarea o /ship actualiza las secciones 4 (Estado) y 10 (Changelog). El resto cambia solo si hay decisión nueva de arquitectura.
