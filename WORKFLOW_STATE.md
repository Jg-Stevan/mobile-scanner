# WORKFLOW_STATE — mobile-scanner

Última actualización: 2026-09-26

## Tareas Completadas
- **F6.5 fixes de F5 por validación humana (sandbox · 2026-09-26):** tres
  hallazgos del humano con evidencia real (2 PDFs actas E-14 arrugadas + CER
  lote 1/2 + revision forense del revisor — ver `PLAN_EVIDENCE/F5/validacion/`):
  (1) **Sin editor en f5** — la página 3 del PDF lote 1 era ruido puro (warp
  atrapó textura) y no había forma de corregirla → editor de esquinas de F4
  portado a f5 (mismo contrato: `openEditor()` → `submitEditedQuad`/
  `revertEditedQuad`/`cancelEditing`; `lastWarpMeta` subido a módulo; botón
  habilitado SOLO en estado 'captured'; `onEdited` repone `lastSourceBlob`).
  (2) **PDF sobre presupuesto** — lote 1: 5.28MB/3págs vs DoD <3MB (q0.90 sin
  re-escala; la página-ruido costaba 1.9MB: el ruido no comprime) → export
  ADAPTATIVO: `pdfBudgetBytes` (piso 3MB, ~1MB/pág, techo 8MB) + `EXPORT_STEPS`
  (0=identidad q0.90 → 2600px q0.82 → 2200px q0.78); el worker acepta ahora
  `quality`/`maxLongSide` en `EnhanceRequest` (ADITIVO — re-escala ANTES del
  enhance vía drawImage); E2E real: 4.17MB → paso 2600 → **2.04MB**.
  (3) **Las miniaturas no reflejaban el modo** ("los modos solo se ven al
  exportar" era una trampa de UX) → thumbs renderizadas con el modo vigente
  (cache id|modo|tam, fallback al original si el worker está ocupado; el tag
  nombra ahora lo que se ve). Hallazgo CER lote 2 (registro, no código):
  **natural gana** (0.175/0.394) y **gray/CLAHE es el peor** (0.648) en papel
  arrugado — la preocupación §F5 del plan confirmada con números; bw
  sobrevive (0.30) y es ~10× más barato (112KB/pág). Tests: +7 unit
  (363/363, tsc limpio). E2E nueva `test-f65-f5-fixes.mjs` 6/6 sobre el
  artefacto con opencv REAL (lección: el stub de cv rompe el warp con
  "e.Mat is not a constructor" — vendor local funciona). Regresión verde:
  F6.1 2/2, F6.2 3/3. Evidencia: `PLAN_EVIDENCE/F6/f65-fixes/`.
  ⏳ Humano: `git am f6.5-f5-fixes.patch` + push + re-test: editar el quad de
  una captura mala en f5, exportar <3MB, ver las thumbs cambiar con el modo.
- **F6.4 robustez de errores + matriz de dispositivos (sandbox · 2026-09-26):**
  PLAN §F6 filas "Errores" + "Matriz de dispositivos".
  (a) `src/camera/cameraErrors.ts` PURO: `classifyCameraError` (por `err.name`
  Y por mensaje — cubre errores envueltos) → código + título + pista accionable
  + retryable; `CameraInitError` (code + cause) en CameraController conservando
  mensajes históricos (/3 niveles/, /sin cámaras/) — tests antiguos intactos.
  (b) init() conserva el error del DESBLOQUEO: permiso denegado + probes muertos
  ya no mienten como "sin cámaras" (code `permission`).
  (c) `src/camera/lifecycle.ts`: `attachLifecycle` (visibilidad inyectable) +
  `trackIsLive`; `ScanOrchestrator.extendDeadline()` re-arma el plazo de 8s al
  volver de background (el tiempo oculto no es falta de detección) — no-op fuera
  de `detecting`. FrameLoop NO se toca: rAF/rVFC ya se congelan solos.
  (d) Wiring f4/f5: catch clasificado SOLO para CameraInitError (los errores de
  la cadena opencv pasan con sus candidatos intactos — hallazgo de la propia
  regresión F6.1), track `ended` → banner recuperable que NO reconstruye la app
  (reintento = re-adquirir SOLO la cámara; galería/colector conservados),
  `watchOrientation` conectado por fin (D2), background→visible valida el track.
  (e) `docs/matriz-dispositivos.md`: matriz (SM-A566E, iPhone 17 Pro, Playwright)
  + checklist semanal W1-W11 + log de rondas.
  Tests: +26 unit (356/356, tsc limpio). E2E nueva `test-f64-robustez.mjs` 4/4:
  permiso denegado→banner clasificado, rotación en vivo→overlay re-encadrado,
  background→extendDeadline (spy) + track vivo, track ended→recuperación completa.
  NOTA entorno: headless mapea denegación a NotSupportedError (quirk) → Caso 1
  inyecta NotAllowedError estándar; el disparo real va en checklist W4.
  Regresión completa verde (7 suites E2E). Evidencia: `PLAN_EVIDENCE/F6/robustez/`.
  ✅ Humano (2026-09-26): `git am` aplicado
  (d6da7ba) + push; primera ronda del checklist semanal pendiente de log.
- **Adaptación del entorno** (PLAN_ADAPTACION Fases 0-5): 8 agentes globales, AGENTS.md,
  WORKFLOW_STATE.md, 3 skills de dominio, comando `/spike` + `/ship`, HTML del spike F0.
  Evidencias en `PLAN_EVIDENCE/adaptacion/`.
- **T1-carta cerrada (2026-09-21 · /ship doble APROBADO):** spike.html (constante
  PAPER_DEFAULT_IN + 6 ediciones) + PLAN_MAESTRO §4/F3/F4/F5 en carta + coherencia
  skills/comando `/spike` a v3.1. Evidencia en `PLAN_EVIDENCE/2026-09-21-T1-carta/`
  (screenshot Playwright panel DPI 8.5 + diff + sanity 844.8px/99.4 DPI).
- **T2-core cerrado (2026-09-21 · /ship doble APROBADO):** scaffolding Vite+TS strict+Vitest
  (§8) + types.ts (PAPER_SIZES_IN, default carta D1, dpiRuntime opcional) +
  geometry.ts (8 funciones + 6 constantes exactas, gate aspect ratios F3 blindado) +
  20/20 tests verdes, cobertura geometry.ts 94.69% líneas, tsc limpio.
  Evidencia en `PLAN_EVIDENCE/2026-09-21-T2-core/`.
- **T1-R2 cerrada (2026-09-21 · /ship doble APROBADO):** spike.html — fix
  quad native2disp (drawQuad/hitTest multiplican fracción × nativo; guard `!nw||!nh`),
  leak getUserMedia en refreshDevices (tracks detenidos), CSS `#torchBtn.torch-ok`.
  20/20 tests, tsc limpio, verificación Playwright local + deploy: esquinas spread,
  pre-fix colapsaban; drag 0 px error. Evidencia en `PLAN_EVIDENCE/T1-R2/`.
- **T1-R3 cerrada (2026-09-21):** Deploy a GitHub Pages + verificación HTTPS pública.
  URL: https://jg-stevan.github.io/mobile-scanner/spike.html
  - Spike funcional: cámara fake activa (640×480), panel DPI carta 8.5, quad 6122 px verdes (no colapsado).
  - Commit cfa60e1 + push + Pages activo (main/root). Evidencia en `PLAN_EVIDENCE/T1-R3/`.
- **T1-R4 cerrada (2026-09-21 · /ship doble APROBADO):** hallazgos del spike
  Android registrados (D2 orientación/DPI, D3 focusMode, D4 ruta C ignora
  deviceId, corrección takePhoto natural ≈220-240 DPI) en WORKFLOW_STATE +
  PLAN_MAESTRO §4 (nota bajo tabla intacta) y §8 (focusMode D3) + fix spike.html
  (fromEntries con pares [k,v], texto ℹ cap 3500px de salida). Verificado en
  cámara fake 640×480: capabilities raw poblado (pre-fix `{}`). Evidencia en
  `PLAN_EVIDENCE/T1-R4/` (screenshot + cameraProfileLog + diff).
- **T3-quality cerrado (2026-09-21 · /ship doble APROBADO):** src/core/quality.ts
  puro (11 constantes con origen, 7 funciones §5-F2, excentricidad CANDIDATE
  bloqueada con throw — ECCENTRICITY_MARGIN=0.05 pendiente de aprobación
  humana) + 21 tests nuevos (backpressure por timestamps, racha de shutter,
  renormalización exacta). 40/40 tests, quality.ts 100% líneas, tsc limpio.
  Evidencia en `PLAN_EVIDENCE/T3-quality/`.
- **T3-b cerrada (2026-09-21 · /ship doble APROBADO):** excentricidad aprobada
  implementada (computeEccentricityScore: margin 5% lado corto, peor domina;
  total = base × ecc, shutter la hereda). 48/48 tests, quality.ts 100% líneas,
  tsc limpio. Evidencia en `PLAN_EVIDENCE/T3-b-eccentricity/`.
- **T4-worker cerrado (2026-09-21 · /ship APROBADO con adjudicación):**
  esqueleto funcional (withMats LIFO, protocolo detect/result/busy/boot/ready,
  pipeline stub 480p real con corners=null, frameLoop rVFC/rAF + transferables,
  OpenCV 4.5.5 pineado). 65/65 tests, módulos nuevos 100% líneas, tsc limpio.
  E2E 62s: worker 11.5 FPS (base F1), rAF 58.4, heap −17%. Revisor APROBADO;
  revisor-b con 2 findings desestimados por orquestador (640×480 es mandato del
  spec, no hardcode; e2e-60s.json sí existe). Evidencia en
  `PLAN_EVIDENCE/T4-worker/`.
- **F1 cerrada (código · 2026-09-22 · /ship doble APROBADO):** QuadDetector real
  (approxPolyDP→selectQuad del core, fracciones del original, stats del crop) +
  decisión Fase 0 PRESERVE + Canny 50/150 (benchmark 6 fixtures) + overlay con
  D2. 116/116 tests, cobertura ≥95%, tsc limpio. Vivo 14.6 FPS / p95 90.8ms /
  gtErr 0.0024; estrés 10 min heap −15.8% (DoD T4 pagado). ⏳ Falta validación
  humana en SM-A566E + iPhone (ver Tareas en Progreso). Evidencia en
  `PLAN_EVIDENCE/F1/`.
- **F1-a cerrada (2026-09-22 · /ship doble APROBADO):** correctiva de auditoría —
  fix error→freeze en frameLoop (busy se resetea en 'error'), contador
  captureErrors, unlock de etiquetas en init (origen fresco), MIN_CONTOUR_AREA_PCT
  con origen honesto (sin cambio lógico), harness mode=camera (D3 + Torch) y
  redeploy /f1/. 119/119 tests, tsc limpio. E2E fake-cam: 817 resultados,
  error simulado sin congelar. Evidencia en `PLAN_EVIDENCE/F1-a/`.
- **F1-b CERRADA (código + validación humana iPhone 2026-09-22):** D6 validada
  empíricamente — panel muestra "Cámara trasera" (simple), 19.5/28.0 FPS,
  latencia 18-23ms, torch ON re-verificado. Futuras mediciones iOS sobre la
  lente correcta. Nota: iOS reporta el track transpuesto (3840×2160 en
  portrait) — quirk de getSettings; el detector es inmune (fracciones).
  Evidencia en `PLAN_EVIDENCE/F1-b/`.
- **F1-opt P1: SIN EFECTO en Samsung (medición humana 2026-09-22):** 11.0
  portrait / 13.6 landscape vs baseline 12.3/13.1 (ruido). Bottleneck Exynos =
  costo fijo por píxel + transporte (P1 solo ayudó en iPhone texturizado).
- **F1-opt P2: SIN EFECTO esperado y confirmado en regresión (sintético):**
  cap 8 intacto en fixtures (mismos errores). Medición humana P2: 12.3
  portrait (Δ=0) → regla Δ<+1 disparó P3.
- **F1-opt P3 VALIDADA (medición humana 2026-09-22):** SM-A566E 14.0 portrait /
  14.4 landscape · p95 58ms (−37% vs baseline) · fluidez visual humana
  ("va bastante fluido, va bien"). P3 fue la palanca efectiva (+14% FPS);
  P1/P2 sin efecto (bottleneck: costo fijo por píxel — documentado).
- **F1 COMPLETADA (2026-09-22):** código (116→125 tests, cob ≥95%, tsc) +
  humano en 2 dispositivos + D7. Evidencia en `PLAN_EVIDENCE/F1*/`.
- **F2-c cerrada (2026-09-22 · /ship doble APROBADO):** k-de-n (4/6 en 1200ms)
  desbloquea acta densa (antes: 3.1 FPS, racha 600ms imposible; ahora: auto <5s).
  Timeout sin vibrar (solo toast) elimina confusión vibración/captura. Flash iOS
  restaurado en harness. 156/156 tests, tsc limpio. Evidencia en
  `PLAN_EVIDENCE/F2-c/`.
- **T6 cerrada (2026-09-22 · /ship doble APROBADO):** cierre del spike
  (D5/D6, takePhoto-iOS sin boost, decisiones 1-3, matriz congelada) + push de
  6 commits y redeploy Pages verificado (marcadores T1-R4 en servido + raw
  poblado en público). Evidencia en `PLAN_EVIDENCE/T6/`.
- **T5-camera cerrado (código · 2026-09-21 · /ship APROBADO con adjudicación):**
  CameraController (D3, gUM en cascada 3840 ideal sin ratio, profile, torch,
  orientación) + hiResCapture (rutas A/B/C primitivas + EXIF). 89/89 tests,
  Controller 98.9%/hiRes 95.2% líneas, tsc limpio. E2E fake cam: profile,
  ruta B == settings, EXIF-6 → 50×100, torch unsupported. Revisor APROBADO;
  revisor-b 1 finding desestimado (cap 3500px rige salida warp/F3, no el hint
  `ideal` de entrada — el spec T5 exige 3840). ⏳ Falta validación humana en
  SM-A566E (ver arriba). Evidencia en `PLAN_EVIDENCE/T5-camera/`.
- **F3-a cerrada (código · 2026-09-22):** re-detección sobre la foto en
  ScanOrchestrator (deps nuevas `photoProcessBitmap` + `detectPhoto`:
  downscale a 400-clase vía `computeProcessDims` + `DetectRequest` al worker,
  quad en coords de foto; gate final con `revalidate` sobre el downscale de la
  foto; fallback prior del stream escalado con `scaleQuad` +
  `needsEditorReview=true`; sin reintento automático). `quadPrior` conserva su
  nombre (equivale al `priorQuad` de la orden; el harness F2 lo consume). Hook
  F3-b (CornerRefiner) marcado en `redetectOnPhoto`. 162/162 tests, tsc limpio.
- **F3-c cerrada (código · 2026-09-22):** warp final (PLAN_MAESTRO §F3).
  `src/core/warp.ts` nuevo (WARP_MAX_LONG_SIDE=3500, UNSHARP 0.5/1.5,
  `computeWarpDims` del quad — sin ratios hardcodeados) + `WarpRequest`/
  `WarpResult` en protocolo + `warpPage` en pipeline (INTER_CUBIC + unsharp,
  todo en `withMats()`) + rama `'warp'` en el worker (mismo backpressure que
  `'detect'`, `busy` reseteado en `finally`) + dep `requestWarp` en el
  orquestador (`CapturedPhoto.warped/warpW/warpH`; fallo → null y sigue la
  cruda, sin reintento). Integrada con el quad sin refinar (F3-b no había
  aterrizado — precondición de la orden). 182/182 tests, tsc limpio. Estrés
  10 min detect+warp: 513664 iters, 0 leaks, heap 12.2→8.4MB (APTO).
- **F3-b cerrada (código · 2026-09-22):** CornerRefiner real (blindajes 1-3 §F3).
  `src/core/cornerBands.ts` nuevo (`computeBandRects`: max(30px,1.5%·lado),
  clamp a foto, consume BAND_* de geometry) + `refineQuad` en pipeline (Canny por
  banda → puntos → `fitLineTrimmed` → `refineQuadFromLines`; lado sin puntos =
  línea degenerada → fallback por lado; MIN_EDGE_POINTS=20, única constante nueva)
  + refine ANTES de la homografía en la rama `'warp'` (`WarpResult` +=
  `refinedQuad`/`refined`/`fellBack`) + `cornerRefiner.ts` deja el stub
  (`assembleRefinedQuad` + `needsEditorReview` para F4) + `CapturedPhoto.quadRefined`
  (lado caído → needsEditorReview, blindaje 3). DoD precisión: fixture 3000×4000
  con entrada ±6px (error 400-clase) → refinado a 0.371px del GT (<1px).
  201/201 tests, tsc limpio. Estrés 10 min detect+refine+warp: 937502 iters,
  0 leaks, heap 13.2→9.0MB (APTO).
- **F3 COMPLETADA (código + validación humana 2 dispositivos · 2026-09-23):** warp + refiner
  reales (`refined: true 4/4`, `warpeado: true` 3/3 en Samsung tras Fix 1 WarpPixels +
  createImageData), auto-shutter con acta densa, iPhone OK, reproducibilidad geométrica
  (acta 0.323/0.326; papel blanco 0.7727 = 8.5/11). F3-a re-detección · F3-b refiner
  0.371px · F3-c warp · F3-d higiene · F3-e fix warp caído (E2E 410×341, estrés 9242
  warps 0 errores) cerradas.
- **F4 CERRADA (código + validación humana 2 dispositivos · 2026-09-25):** editor
  de esquinas (loupe lado opuesto al dedo, validación en vivo, badges honestos,
  confirm/revert/cancel) + colector opt-in (contrato DatasetEntry, anti-sesgo:
  el registro nunca mezcla auto con ajuste) + diana CDE (dianaMath puro, 13/13).
  Cadena de fixes hasta el cierre: F4-fix-arranque (boot recuperable) →
  F4-fix-typo-editBtn (causa raíz del F4 muerto) → F4-validación ronda 1
  (3 hallazgos del editor corregidos) → f4-fix-stale-fellback (fbOf: fellBack
  solo si la foto fue warpeada). Ronda 2 multi-dispositivo (ZIPs del colector,
  rama dataset-ronda2): Samsung 7 + iPhone 17 Pro 10 = 17/17 contrato limpio;
  3 adjustedQuad reales (2 edición clásica + 1 recuperación manual TOTAL de un
  fondo-claro sin detección — re-warp del quad manual con fellBack propio,
  lección: la regla "autoQuad null ⇒ fellBack null" exigía warp, no auto);
  diana en vivo: ±58.44 mm al 95% (N=5; 185 mm) Samsung · ±23.99 mm (N=7)
  iPhone; iOS orientación correcta (track apaisado, fotos retrato, quads
  foto-relativos) y camino nulo honesto (captura accidental sin detección
  registrada limpia). Parches verificados byte-exactos en origin/main.
  Evidencia: PLAN_EVIDENCE/F4/ (colector ronda1+ronda2, validacion,
  F4-fix-*).

## Tareas en Progreso
- **F4-validación ronda 1 — fixes del editor (harness+UI · 2026-09-25):** el
  humano verificó el arranque ("volvió a la normalidad el disparo y captura
  automática") y reportó 3 hallazgos del editor: (1) lupa bajo el dedo → MOVIDA
  al lado vertical opuesto (`loupeCenter()`, crosshair = punto de corte real);
  (2) "circulitos de alto/ancho no funcionan" → eran BADGES de refine pintados
  SIEMPRE con fellBack=null → ahora solo se dibujan con info real; (3) GRAVO:
  confirmar muerto en captura manual → cadena reproducida: quad cruzado al
  arrastrar → 'invalid' → toast INVISIBLE bajo #editorRoot (z-index 50 cubre el
  viewport) → cero feedback. Fix: validación EN VIVO en el editor (polígono
  rojo + banner en canvas via quadIsValid/validateQuad) + #editorErr dentro del
  overlay + .catch en confirm/revert. Rebuild f4/ (bundle Cd1nBD7V). E2E del
  artefacto: invalid visible+bloquea, válido confirma, 0 pageerrors; 314/314
  tests, tsc limpio. Evidencia: PLAN_EVIDENCE/F4-validacion/ (ronda 1).
  ✅ PAGADO en ronda 2 (2026-09-25): humano aplicó los parches y repitió
  editor + diana + colector — ver F4 CERRADA en Tareas Completadas.
- **F6.3 telemetría opt-in (sandbox · 2026-09-25):** núcleo puro
  `src/telemetry/telemetry.ts` (parseDsn + redactMessage + buildEnvelope +
  createTelemetry) + wiring `harnessTelemetry.ts` (botón OFF/ON en panel,
  hooks ADITIVOS error/unhandledrejection, `window.__telemetry`). Principios:
  OFF por defecto (0 bytes salen sin opt-in — probado en E2E), SIN SDK por CDN
  (formato envelope oficial de Sentry con send propio — lección F6.1),
  redacción doble de query strings/blob:/file: (jamás fotos ni quads), rate
  limit 20 envíos/sesión que cuenta también los fallidos (anti-martilleo),
  DSN por `localStorage` (vacío ⇒ solo conteo local honesto). 11 tests unit +
  E2E 4 casos (OFF=0 POSTs, envelope válido con token redactado, rate limit
  20+6, persistencia). Regresiones verdes (330/330, 6 E2E). Evidencia:
  `PLAN_EVIDENCE/F6/telemetry/`. ✅ Humano (2026-09-26): `git am` aplicado
  (f6d6f4e) + push. DSN real pendiente: cuando exista cuenta Sentry.
- **F6.2 PWA offline (sandbox · 2026-09-25):** service worker hecho a mano (~120
  líneas, SIN Workbox-CDN: sería otro SPOF tras el hallazgo F6.1 — desviación
  documentada en el reporte) + `manifest.webmanifest` (start_url → harness F5) +
  iconos 192/512 maskable. `sw.js` GENERADO por `scripts/build-sw.mjs` con precache
  calculado del artefacto (cierre de chunks incl. worker y pdfExport; 11 entradas);
  estrategia: navigate network-first→caché, resto cache-first→red, cross-origin
  intacto; VERSION=sello de build → purga en activate. Registro inyectado en los
  HTML construidos (build-harness-f4/f5.mjs, idempotente) con guardas `sw-off` /
  `sw=1` / webdriver (aisla las E2E con stubs SIN editarlas). **BONUS:** rebuild de
  `f5/` lleva la cadena F6.1 al worker desplegado de F5 (que seguía en `DU2EpkNr`
  pre-F6.1 → f5 dependía del CDN en dispositivo). E2E nueva 3/3: instalación +
  **boot COMPLETO OFFLINE desde caché** (worker + opencv 8.6MB) + guarda. Regresiones
  verdes (319/319, tsc, 4 E2E). Evidencia: `PLAN_EVIDENCE/F6/pwa/`. ✅ Humano
  (2026-09-26): `git am` (596299a) + push + **PWA instalada y 2º arranque en
  modo avión validado en dispositivo** ("funciona bastante bien" — humano).
  Falta la 2ª device por confirmar (checklist semanal).
- **F6.1 opencv self-host (sandbox · 2026-09-25):** `vendor/opencv-4.5.5.js`
  (build techstark, línea Module revertida a global) + cadena vendor→CDN con
  observabilidad (`opencvCandidateUrls` pura + 5 tests + panel `#mOpencv` en f4);
  E2E 2/2 (boot REAL local + SPOF muerto recuperable). Commit 8444441 aplicado y
  desplegado por el humano. ✅ Humano (2026-09-26, indirecto): el boot OFFLINE
  en modo avión (F6.2) solo es posible con opencv servido desde
  `vendor/`→precache — cadena local validada en dispositivo.
  Pendiente opcional: verlo explícito en `#mOpencv` de f4.
- **F4-fix-typo-editBtn cerrada (harness · 2026-09-25):** tras aplicar y pushear
  el fix de arranque (`6403db4`), el humano reportó F4 SIGUE muerto en dispositivo
  (videos f3/f4 enviados; no llegaron al sandbox). Causa raíz REAL encontrada y
  corregida: typo en línea 452 del harness — `$('#editBtn')` con `$ =
  getElementById` SIN '#' → null → TypeError → `main()` moría ANTES de
  `startFrameLoop` y del handler del shutter (preview vivo + botones muertos +
  auto-shutter inexistente). Coincide 1:1 con el síntoma humano. Lección: la E2E
  anterior solo ejercitó el camino de FALLO (CDN 403 en sandbox) — nunca un boot
  completo; el typo era invisible en sandbox. Nota: F5 usa el MISMO worker/CDN y
  funciona en el dispositivo → el opencv CDN carga bien en la red del humano (el
  403 Cloudflare es anti-bot de datacenter; hallazgo de infra para F6/PWA sigue
  válido). Fix: 1 carácter + rebuild `f4/` (bundle `DW_MiY1r`, generación previa
  conservada). E2E del ARTEFACTO con opencv stub: boot completo, shutter activo,
  `__orch`/`__editor` definidos, 0 pageerrors; 314/314 tests, tsc limpio.
  Evidencia: `PLAN_EVIDENCE/F4-fix-typo-editBtn/`. ✅ PAGADO: humano aplicó y
  pusheó (46ccfd4) — el re-test ronda 2 confirma el editor operativo.
- **F4-fix-arranque cerrada (harness · 2026-09-25):** el humano reportó F4 muerto
  (shutter manual y auto sin respuesta, incluso con `?autostart=1`). Diagnóstico
  Playwright: boot all-or-nothing — `main()` sin catch utilizable; un fallo del
  CDN de opencv (reproducido: docs.opencv.org 403 challenge Cloudflare vía
  `importScripts`, no resoluble en worker) dejaba preview vivo + botones muertos
  + error enterrado en `#out`. Fix SOLO harness (patrón F5 probado en
  dispositivo): botón `Iniciar cámara` + error visible en `#err` + reintento con
  guard + shutter deshabilitado hasta boot completo; `?autostart=1` conservado
  para E2E. Redeploy `f4/` con generación previa de assets conservada (higiene).
  314/314 tests, tsc limpio. Hallazgo de infra registrado: fragilidad CDN opencv
  → propuesta de vendorizar 4.5.5 en repo (F6/PWA, ver
  `PLAN_EVIDENCE/F4-fix-arranque/`). ⏳ El humano valida F4 con el harness
  redeployado (URL sin parámetros).
- **F4 en curso (código · 2026-09-24):** editor manual de esquinas + dataset F6.5 +
  diana. FSM `editing` en ScanOrchestrator (`openEditor`/`submitEditedQuad`/
  `revertEditedQuad`/`cancelEditing`; `submit` ok → 'captured' + cooldown normal;
  `revert` ok → sigue 'editing' con re-warp del auto; `CapturedPhoto.adjustedQuad`,
  evento `onEdited`). `src/ui/AdjustEditor.ts` = DOM ligero sin global (fracciones
  del original; `openPhoto` fabrica el layer de esquinas; hitTest + drag ≥44px +
  lupa 3×; badge en lados con `fellBack`). `src/core/dataCollect.ts` +
  `src/export/datasetStore.ts` (IndexedDB + ZIP con fflate aprobado;
  TRAINING_JPEG_QUALITY=0.85; anti-sesgo: autoQuad SIEMPRE registrado,
  `addAdjusted` mismo id sin re-encode; contador X/300; aviso cuota >70%; persist
  en iOS) + `src/core/dianaMath.ts` (`cdeReport` "±X mm al 95%") +
  `scripts/gen-diana.mjs` (diana Carta 190.5×254 mm imprimible, auto-chequeos OK).
  Harness fuente `harnesses/test-harness-f4device.html` + build `f4/` (colector default OFF,
  opt-in toggle, exportar ZIP, modo diana). 248/248 tests, tsc limpio. ⏳ Falta
  validación humana en dispositivo físico (edición táctil + colector + diana).
- **F5 en curso (código · 2026-09-24):** multipágina + 4 modos + PDF. `imageModes.ts`
  (Sauvola O(W), white point), enhance JS dentro del worker (`enhanceJs.ts`: LAB/CLAHE
  y shadow-removal; createCLAHE no existe en OpenCV 4.5.5) + rama `enhance` con
  backpressure, `PageStore` IndexedDB, `pdfExport` Letter/A4, `PageGallery` con
  orden/selector global y harness F5 con CER Tesseract. 314/314 tests, tsc limpio.
  PDF E2E de 5 páginas 2040×2640: 907803 bytes (<8MB). Estrés final 10 min:
  E2E 2689 ciclos detect+warp+enhance, 0 errores, enhance p95 153.3ms; Node
  5990 iteraciones, 0 errores, heap 12.45→12.14MB (-0.31MB). applyMode Node
  2040×2640: Color 1.49s · Gris 1.01s · B/N 1.36s · Natural 1.19s.

## Operación del entorno (no-tareas — creada en F3-d)

**Regla:** "Tareas en Progreso" solo lista trabajo activo con spec; toda operación
de entorno/infraestructura se registra aquí (trazabilidad — auditoría F2-b).

- **Higiene de deploy de harnesses F2/F3/F4 (2026-09-24):** al reconstruir un
  harness, conservar al menos una generación previa de sus assets hasheados.
  Los HTML cacheados pueden seguir resolviendo el bundle anterior mientras el
  CDN expira; no borrar el asset previo durante el deploy. (2026-09-24: las
  FUENTES de los harnesses se reorganizaron en `harnesses/` — spike.html +
  test-harness-f{2..5}device.html, imports `../src/`; los builds `fN/` de
  Pages siguen donde están. El build de deploy usa config vite temporal con
  `base: './'` y entrada el HTML del harness, borrada tras el deploy.)


- **Sonda modelos-v2 (2026-09-22, re-clasificada en F3-d):** sonda de
  conectividad/modelos sin spec ni /ship — operación de infraestructura, no tarea
  de proyecto. Traza: `PLAN_EVIDENCE/sonda-modelos-v2.txt` (contenido `sonda-v2-ok`,
  "pipeline v2" no existe en el proyecto) creado por el commit automático
  `b0f3cca checkpoint(opencode)`. La entrada citada por la auditoría F2-b NO se
  encontró en este archivo (verificado por grep 2026-09-22) — el txt es la única
  traza; se conserva por regla de no-borrado de la auditoría. Detectada por
  auditoría externa F2-b.

## Backlog F1 (notas registradas 2026-09-21 — PAGADAS en F1 salvo custom OpenCV)
- ~~Benchmark SQUASH vs PRESERVE~~ ✓ pagado en F1 Fase 0 (decisión PRESERVE).
- ~~Estrés de 10 min~~ ✓ pagado en F1 (heap −15.8%).
- Build custom OpenCV (~2-3MB) pre-producción → movido a backlog F6/PWA.

## Backlog F4 (insumo de F3 — registrado en F3-d, hueco de auditoría F3-b)

- F4 debe consumir `needsEditorReview(quadRefined ? fellBack : null)` — con
  `fellBack` null el orquestador NO marca revisión (decisión F3-b contra regresión
  F3-c); el helper trata null=desconocido→revisar, y F4 debe heredar ese criterio.

## Verificaciones pendientes (TUI/humanas)
- CERRADAS (detalle en Tareas Completadas y PLAN_EVIDENCE): F2-c re-test humano
  (APROBADA 2026-09-22, `PLAN_EVIDENCE/F2-device/`) · T5-humano (cubierto por
  F1-humano/D3) · torch real iOS (ON en F1-b) · adaptación T0.5/T1.4/T2.4/T4.3 (2026-09-20).
- **T4.1 `opencode mcp list` en TUI (4/4)** — ⏳ última pendiente del plan de
  adaptación (CLI cuelga; verificación visual TUI).
- **F4 validación humana en dispositivo físico** — ✅ CERRADA (2026-09-25):
  edición táctil + colector + diana validados en SM-A566E e iPhone 17 Pro
  (ronda 2, ver F4 CERRADA en Tareas Completadas).
- **F5 revisión visual humana** — ⏳ banding CLAHE (D-F5-b) + resultados del
  harness CER Tesseract por modo/categoría (evidencia subida 2026-09-25 en
  `PLAN_EVIDENCE/F5/validacion/` — veredicto del revisor externo pendiente).
- **D-F5-c validación en dispositivo** — ⏳ (2026-09-26) filtro Texto claro +
  snap de esquinas + captura trocida guardable + fix detached; propuesta en
  `PLAN_EVIDENCE/F5/propuesta-D-F5-c-texto-claro.md`.

## Decisiones de Arquitectura
- **Fuente:** PLAN_MAESTRO v3.1 congelado · Fase actual: **F6 endurecimiento + D-F5-c** — F6.1..6.4 APLICADOS y desplegados en Pages; **D-F5-c (2026-09-26)**: set de filtros Adobe Scan (Color original/Escala de grises/Color automático/Texto claro — `bw` retirado, legado→`text`), quad no-bloqueante (bounding box), snap a esquinas (3 gestos), fix detached-bitmap f5, botón "Detección automática"; propuesta en `PLAN_EVIDENCE/F5/propuesta-D-F5-c-texto-claro.md`. Pendiente humano: validación en dispositivo (D-F5-c + PWA + checklist W). F6.5 condional después.
- **Fix 2026-09-20 (T4.3):** `spike.html` constraints ahora piden solo presupuesto de píxeles sin ratio;
  aviso de cap >3500px añadido al log. Re-validado sin errores.
- **Aprobación humana 2026-09-22 (FPS, condicional):** estrategia A-primero —
  optimizar con las palancas del plan (RETR_EXTERNAL, cap contornos, 400p); si
  tras agotarlas no se alcanza ≥15 FPS en SM-A566E (peor orientación), la
  desviación   **D7** se activa AUTOMÁTICAMENTE (umbral ≥15 → ≥12 sostenido, p95
  <100ms mantenido, fluidez visual confirmada por el humano). Sin nueva consulta.
- Los agentes NO re-discuten decisiones del maestro; proponen por escrito, nunca inline (ver AGENTS.md).
- **Aprobación humana 2026-09-21 (excentricidad):** ECCENTRICITY_MARGIN = 0.05
  del lado corto; score = mín de clamp(dMin/margin, 0, 1) por esquina;
  integración MULTIPLICATIVA (total = base × ecc) — la fórmula §5-F2 queda
  intacta. Adjudicación: la renormalización genérica Σ(w·v)/Σ(w) de T3 rige
  sobre el "(0.4/0.7…)" ambiguo del brief (sumaría >1).

## Desviaciones Documentadas
- **D-F5 (registrada · F5):** OpenCV.js 4.5.5 no expone `createCLAHE` ni
  `COLOR_RGBA2Lab`; los modos se implementan en JS puro dentro del worker,
  Node-testeable, sin `cv.Mat` fuera de `withMats`.
- **D-F5-b (registrada · F5):** CLAHE 2.0/8×8 usa LUT de la celda sin
  interpolación bilineal entre vecinas para mantener el budget; banding/rejilla
  queda pendiente de CER + revisión visual humana en el harness.
- **D-F5-c (registrada · 2026-09-26 · petición humana con video Adobe Scan):**
  set de filtros renombrado a Color original/Escala de grises/Color
  automático/Texto claro; modo `bw` (Sauvola) RETIRADO — legado persistido
  carga como `text` (normalizeEnhanceMode). Modo `text` = corrección de
  sombras + white-point p80 + S-curve (pivote 0.72, contraste 1.35), SIN
  binarización. Constantes INICIALES de ingeniería; validar con CER + revisión
  visual antes de congelar. Además (misma ronda): quad inválido deja de
  bloquear (warp con bounding box, status 'fallback'), snap de esquinas a la
  detección automática (radio 4% lado largo, máx 3 gestos), fix aliasing
  detached-bitmap en harness f5, botón "Volver a auto" → "Detección
  automática". Ver `PLAN_EVIDENCE/F5/propuesta-D-F5-c-texto-claro.md`.
- **D1 (aceptada por humano · 2026-09-21 · tarea T1):** formato de referencia A4 → CARTA (8.5 × 11 in). Motivo: estándar regional + disponibilidad real de papel carta en el entorno de medición. A4 queda como alternativa documentada.
- **D2 (registrada · T1-R4 · spike Android SM-A566E):** la orientación del teléfono afecta el DPI en documentos portrait: vertical ≈ 254 DPI teórico vs horizontal ≈ 196 (el lado corto del sensor alinea con el lado largo del papel). Acción futura: guía de orientación en UI (F1/F2).
- **D3 (registrada · T1-R4 · spike Android):** criterio de selección de cámara = `focusMode` con "continuous"/"single-shot" (autofocus real). Cámaras solo-[manual] = fixed-focus → descartadas. Validado: cámara 2 (ultra-wide) sin AF y sin torch → descartada.
- **D4 (registrada · T1-R4 · spike Android):** la ruta C (`input capture`) ignora el `deviceId` seleccionado; siempre usa la principal de la app nativa (validado: 6120×8160 con ambas cámaras).
- **Corrección de expectativa §4 (registrada · T1-R4 · spike Android SM-A566E):** `takePhoto` Android con encuadre natural (preview 9:16, el papel no llena la foto 3:4) ≈ **220-240 DPI**, no ~353. El teórico 353 asumía el papel llenando la foto — condición no alcanzable desde el preview. Validado: video 225 DPI (88.6% encuadre).
- **D5 (registrada · T6 · spike iPhone 17 Pro):** iOS expone grupos virtuales de
  dispositivos (no lentes individuales); los 3 grupos traseros midieron track
  idéntico 2160×3840. Control fino de lente en iOS = constraint de `zoom`, no `deviceId`.
- **D6 (registrada · T6 · spike iPhone):** iOS NO expone `focusMode` (— en los 3
  grupos) → D3 cae al fallback T5. Extensión: heurística por label — preferir el
  grupo simple "Cámara trasera", descartar "ultra gran angular"/"tele" como principal.
- **Actualización takePhoto iOS (registrada · T6 · spike iPhone):**
  `ImageCapture.takePhoto` EXISTE en Safari moderno (0/5 fallos, 227-426ms, más
  rápido que SM-A566E ~940ms) PERO sin boost de resolución (2160×3840 == track).
  En iOS las rutas A/B son funcionalmente equivalentes; el diseño T5 (detección +
  fallback) ya lo maneja sin cambios de código.
- **D7 (ACTIVADA · pre-aprobada humano 2026-09-22, efectivizada en F1-opt P3):**
  umbral FPS detección ≥15 → **≥12 sostenido** con p95 <100ms mantenido y fluidez
  visual CONFIRMADA por el humano ("va bastante fluido, va bien"). Números
  finales SM-A566E: 14.0 portrait / 14.4 landscape · p95 58ms. iPhone: 19.5/28.0
  (cumplía ≥15 sin D7).
- **Hallazgo "documento denso" (registrado · F2-a · test humano SM-A566E, acta
  electoral):** texto densísimo + papel llenando el frame → FPS 3.1 (racha
  600ms con 2.9 FPS sigue justa, pero F2-b corrige inanición), falso "Muy oscuro"
  (corregido en F2-a con sampler sobre crop), ecc ~0.69 (comportamiento
  correcto). Fixes: sampler sobre crop + diag contourCount. Insumo F4/F6.
  **P4 (300px) RECHAZADA por humano 2026-09-22 → D8 ACTIVA.**
- **D8 (ACTIVADA · humanas aprueban 2026-09-22 F2-b · P4 rechazada):** proceso a
  300px rechazado (precisión > fluidez en densos; el manual cubre el extremo).
  FPS del overlay en documentos densísimos aceptado bajo; la calidad del recorte
  (F3) manda.

## Matriz de Dispositivos (congelada 2026-09-21 · T6, evidencia del spike)
| Ruta | Android SM-A566E | iPhone 17 Pro |
|---|---|---|
| Track | 2160×3840 · 254 DPI teórico · medido 206-225 | 2160×3840 · 254 DPI teórico · medido 209-223 |
| Auto takePhoto | 3060×4080 (boost) · ~940ms · ~240 DPI natural | 2160×3840 (sin boost) · 227-426ms · == ruta B |
| Auto drawImage | 2160×3840 | 2160×3840 |
| Manual input | 6120×8160 (50MP) · ~309 DPI tras cap | 3024×4032 (12MP binned de 48MP) · ~309 DPI tras cap |
| EXIF from-image | ✓ Chrome | ✓ Safari |
| Torch | ✓ funcional | capabilities ✓ (toggle real por verificar — pendiente menor) |
| Selección | D3 por focusMode ✓ | D6 por label (focusMode no expuesto) |
| Multipage input | 1 foto/gesto | 1 foto/gesto → UI con retorno fluido |

Decisiones cerradas con estos datos: (1) auto-shutter iOS con track 4K viable
(~254 DPI teórico; ruta C como "máxima calidad" opcional); (2) multipágina 1
foto/gesto en ambas plataformas; (3) matriz final arriba. Ambos dispositivos
convergen a ~309 DPI tras el cap de 3500px: el cap normaliza la salida
independiente del sensor.
- **Limitación documentada F1 (registrada · revisión externa F1 · fixture b):**
  papel sobre fondo CLARO (bajo contraste) NO se detecta en ninguna config
  (SQUASH/PRESERVE × Canny 50/150/75/200). Es el caso blanco-sobre-blanco del
  plan (riesgo registrado): escape = botón manual SIEMPRE visible (F2), solución
  definitiva = F6.5 condicional. No se "arregla" con trampa de umbrales.