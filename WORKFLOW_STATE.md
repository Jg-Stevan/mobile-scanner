# WORKFLOW_STATE — mobile-scanner

Última actualización: 2026-09-21

## Tareas Completadas
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
- **F1-b cerrada (código · 2026-09-22 · /ship doble APROBADO):** D6 implementada
  (filtro por label + menos-palabras; D3 intacta). 124/124 tests. ⏳ Re-test
  humano iPhone pendiente (panel debe mostrar "Cámara trasera"). Evidencia en
  `PLAN_EVIDENCE/F1-b/`.
- **F1-opt P1 implementada (2026-09-22 · /ship doble APROBADO, NO validada):**
  RETR_EXTERNAL + regresión fixtures intacta (b sigue fallando igual).
  Redeploy /f1/ con la palanca (bundle verificado). ⏳ Falta FPS humano en
  SM-A566E (≥15 → parar; <15 → palanca 2; agotadas → D7 pre-aprobada).
  Evidencia en `PLAN_EVIDENCE/F1-opt/`.
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
## Tareas en Progreso
- _F0 spike humano: ejecución COMPLETADA en Android + iPhone (T6) — queda solo el
  pendiente menor del toggle torch real en iOS._
- _T5-humano SM-A566E pendiente (selección camera 0, profile, ruta A) — ver abajo._
- _F1-humano COMPLETADA (2026-09-22 · resultados humanos registrados):_
  - _SM-A566E: quad verde en ambas orientaciones · FPS 12.3 (portrait) / 13.1
    (landscape) — NO cumple ≥15 · latencia p95 94/79ms ✓ · D2 correcta (hint ON
    en landscape, OFF en portrait) · D3 eligió camera 0 (cierra T5-humano)._
  - _iPhone 17 Pro: quad verde ambas orientaciones · FPS 16.2/17.9 ✓ · latencia
    p95 20/19ms ✓ · D2 correcta · torch real ON verificado (cierra T6)._
  - _Hallazgo D6 (empírico): iPhone seleccionó "Cámara trasera con ultra gran
    angular" (fallback D3 sin focusMode + sort por resolución) → F1-b obligatoria._

## Backlog F1 (notas registradas 2026-09-21, revisión externa T4 — no bloquean T4)
- Benchmark de detección real en 2 condiciones (matiz del finding 1 de revisor-b,
  ratificado como tema real por el humano): resize 640×480 con distorsión
  anisotrópica vs resize preservando aspecto (~270×480 para 9:16). Las fracciones
  se preservan en ambos (mapeo F1→foto correcto); decidir con datos por robustez
  de Canny/approxPolyDP sobre geometría deformada.
- Estrés de 10 min (heap <20% crecimiento) como DoD OBLIGATORIO de F1 (skill
  opencv-wasm-memoria) — el de 62s de T4 no lo sustituye.
- Evaluar temprano el build custom de OpenCV (~2-3MB solo imgproc): 4.5.5 es de
  2021 y el boot medido es 4.4s con el build completo de 8MB.

## Verificaciones pendientes (TUI/humanas)
- T5-humano (SM-A566E, pendiente): app de prueba → DEBE elegir camera 0 por D3;
  profile ≈ (2160×3840, torch true, 3 focusModes); ruta A takePhoto OK.
  Screenshot del log → completar PLAN_EVIDENCE/T5-camera/.
- T0.5 `opencode agent list` → 8 agentes desde mobile-scanner — **HECHO** (verificado 2026-09-20; evidencia 00 actualizada)
- T1.4 `@explorador` cap ~3500px AGENTS.md:21 — **HECHO** (2026-09-20)
- T2.4 skill `opencv-wasm-memoria` (withMats) con `@implementador-backend` — **HECHO** (2026-09-20)
- T4.3 fallback revisor → revisor-fallback: **HECHO** (2026-09-20; cazó y corrigió ratio 16:9 implícito en spike.html)
- T4.1 `opencode mcp list` → 4/4 desde mobile-scanner — ⏳ **última pendiente** (CLI cuelga; visual TUI)

## Decisiones de Arquitectura
- **Fuente:** PLAN_MAESTRO v3.1 congelado · Fase actual: F1 QuadDetector (spike
  humano COMPLETADO Android + iPhone · T6; matriz congelada abajo en Desviaciones)
- **Entorno adaptado y verificado** (automatizable + TUI de cierre). Único pendiente del plan de
  adaptación: T4.1 `opencode mcp list` en TUI.
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