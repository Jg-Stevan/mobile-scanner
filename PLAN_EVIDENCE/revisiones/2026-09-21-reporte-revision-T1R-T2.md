# Reporte de revisión externa — T1-R (carta) + T2 (núcleo matemático)

- **Proyecto:** mobile-scanner (Vite + TypeScript strict, Node 24)
- **Fecha de sesión:** 2026-09-21
- **Base:** commit `4d99e97` + working tree sin commitear (ver §6 Estado del árbol)
- **Fuente de verdad:** `PLAN_MAESTRO.md` v3.1 congelado · `AGENTS.md` (disciplina obligatoria)
- **Qué se pide al revisor:** veredicto independiente APROBADO / CHANGES_REQUESTED
  por tarea (T1-R y T2), más pronunciamiento sobre el punto §5 (cambios T1-R2
  posteriores a la revisión interna, fuera de su alcance).

---

## 1. Tarea T1-R — Cierre migración A4 → Carta (desviación D1)

**Spec:** `PLAN_EVIDENCE/tareas/T1-carta.md` (decisión humana: carta 8.5×11 in como
referencia; A4 como alternativa documentada).

### 1.1 Cambios (todos en working tree, sin commit)

| Archivo | Cambio |
|---|---|
| `spike.html:157` | Constante única `PAPER_DEFAULT_IN = 8.5` (Carta; A4 = 8.27 en comentario) |
| `spike.html:126` | Input `paperWidthIn` `value="8.5"`, label `(Carta = 8.5 · A4 = 8.27)` |
| `spike.html:121-122` | H2 "sobre carta" + instructivo "tamaño carta, VERTICAL (ancho visible = 8.5 in)" |
| `spike.html:453,472` | Fallbacks `dpiCompute` y `collectReport`: `\|\| PAPER_DEFAULT_IN` |
| `spike.html:140-142` | Texto referencia §4 con rangos carta (~353–364 / ~127–175 / ~254–349 / ~356+) |
| `spike.html:49` | Header "Fuente de verdad: PLAN_MAESTRO v3.1 §4 y §5-F0" |
| `PLAN_MAESTRO.md:7` | Header v3.1 + changelog D1 |
| `PLAN_MAESTRO.md:86-95` | Tabla §4 en carta + nota "cifras exactas las fija el spike" + `anchoQuadPx / 8.5` |
| `PLAN_MAESTRO.md:196` | F3: nota `3500/11 = ~318 DPI en carta → cap VALIDADO, sin cambio numérico` |
| `PLAN_MAESTRO.md:212` | F4: diana en "Carta impresa (8.5×11 in)" |
| `PLAN_MAESTRO.md:231` | F5: `fit Letter (default, D1) / A4 opcional` |
| `PLAN_MAESTRO.md:259` | Licencia MIDV: `(IDs vs carta/A4/recibos)` |
| `.opencode/command/spike.md:7` | DPI runtime `anchoQuadPx / 8.5` (Carta, D1) — evita regresión si se re-ejecuta `/spike` |
| `.opencode/skills/spike-dispositivos/SKILL.md` | Tabla y fórmula a carta; fuente v3.1 |
| `.opencode/skills/ios-camera-quirks/SKILL.md` | Tabla y regla de diseño a carta; fuente v3.1 |
| `WORKFLOW_STATE.md` | Entrada D1 + cierre T1 con evidencia |

**No tocados:** aviso cap 3500px (`spike.html:303`), torch, rutas A/B/C, checklist,
NO-GOALS, stack, fases, `tests/bench/`.

### 1.2 Verificación (ejecutada por orquestador, reproducible §7)
- Grep: cero `|| 8.27`, `value="8.27"`, `/ 8.27` en código vivo. `8.27` solo en
  label informativo, comentario de la constante y docs históricos de evidencia
  (`PLAN_EVIDENCE/tareas/T1-carta.md`, `current_plan.md`, `adaptacion/03-*`, no se editan).
- Playwright real (http local, Chromium): panel DPI muestra `8.5` +
  `(Carta = 8.5 · A4 = 8.27)` + rangos carta. Único error de consola: favicon 404.
- Sanity: quad 0.28–0.72 sobre track 1920px → 844.8px / 8.5 = **99.4 DPI** (verifica fórmula).
- Evidencia: `PLAN_EVIDENCE/2026-09-21-T1-carta/` (screenshot full-page, diff, sanity).
  Nota: esa carpeta contiene además `git-diff-T1-carta.txt`, `sanity-dpi-99.md` y
  `spike-panel-dpi-carta.png` generados por otra sesión en paralelo (12:01–12:03);
  no forman parte de esta entrega.

### 1.3 DoD T1-R
- [x] D1 registrada · [x] v3.1 + changelog · [x] constante única + 6 ediciones
- [x] §4/F3/F4/F5 con valores dados (sin recalcular) · [x] evidencia Playwright + diff
- [x] doble revisor interno APROBADO (revisor detallado 15 puntos + revisor-b)

---

## 2. Tarea T2 — Núcleo matemático `core/` (§8 + §5-F1/F3)

### 2.1 Archivos nuevos
- `package.json` — Vite ^8.3.0, TS ^7.0.2, Vitest ^5.0.1, coverage-v8. Scripts:
  `dev` / `build` / `test` (`vitest run`) / `coverage`.
- `tsconfig.json` — `strict: true` (+ noUnusedLocals/Parameters, verbatimModuleSyntax).
- `vite.config.ts` — mínimo, tests en entorno node, cobertura v8 con umbral líneas 90
  sobre `src/core/geometry.ts`.
- `index.html` + `src/main.ts` — placeholder "app en construcción".
- `src/core/types.ts` (reescrito) — `Corner`; `Quadrilateral` orden fijo TL,TR,BR,BL;
  `QualityScore` (6 componentes 0–1 + `isBlur`); `CameraCapabilities`;
  `CameraProfile` (`dpiRuntime?` opcional — lo llena el spike F0; `capturedAt`);
  `ScanPage` (`blob?`, quad, 4 modos, order); `PAPER_SIZES_IN {letter: 8.5, a4: 8.27}` +
  `PAPER_DEFAULT_IN = 'letter'` (D1). Contratos con § del plan en comentarios.
- `src/core/geometry.ts` (295 líneas, puro, sin DOM ni OpenCV) — 6 constantes exactas
  (`0.25`, `0.05`, `30`, `0.015`, `0.12`, `0.01`, cada una con origen §5-F1/F3) y
  8 funciones: `orderPoints` (suma/diferencia), `quadArea`, `isConvex`,
  `hasSelfIntersection`, `sideRatios`, `validateQuad` (convexo + sin cruce + área
  >25% frame + lados ≥5% del mayor), `sameAspectRatio` (todo por parámetros, cero
  ratios hardcodeados), `scaleQuad` anisotrópico, `fitLineTrimmed` (eje dominante,
  recorte 12%, recta normalizada a²+b²=1), `intersectLines` (null si |den|<1e-12),
  `refineQuadFromLines` (TL=3+0…; fallback **por lado** con flags `fellBack[4]`:
  lado cae si ambas esquinas null; esquina null aislada marca sus 2 lados;
  validación global fallida → 4/4; blindaje 3 §5-F3).
- Placeholders documentados sin implementación (export + TODO de fase):
  `src/core/quality.ts` (T3, **sin umbrales**), `src/workers/detection.worker.ts`,
  `src/camera/{CameraController,frameLoop,hiResCapture}.ts`,
  `src/scan/{ScanOrchestrator,cornerRefiner,enhance}.ts`, `tests/quality.test.ts`.
- `tests/geometry.test.ts` — exactamente los 7 grupos del spec: orderPoints 10°;
  scaleQuad (2,2)+(1.5,2) exactos; gate 1920×1080 vs 4000×3000→false /
  3840×2160→true; fitLineTrimmed con/sin trim (tol 1e-6); intersectLines exacta +
  null; refineQuadFromLines (GT+ruido gaussiano ±3px → ±0.5px; lado sin puntos →
  fallback solo ese lado + flag); validateQuad (mariposa/no-convexo/área 10%→false,
  1:1→true).
- `.gitignore` — añade `coverage/`, `.playwright-mcp/`.

### 2.2 Verificación (ejecutada por orquestador, reproducible §7)
- `npx tsc --noEmit` → exit 0 (strict).
- `npm test` → **20/20 verdes** (19 geometry + 1 placeholder quality).
- `npm run coverage` → geometry.ts **líneas 94.69%** (stmts 93.33, funcs 96.96;
  umbral 90 ✓). Sin cubrir: 3 `throw` defensivos inalcanzables.
- `npm run build` y `npm run dev` (HTTP 200) verificados por implementador.
- Evidencia: `PLAN_EVIDENCE/2026-09-21-T2-core/` (salidas de test/coverage, diff-stat, status).

### 2.3 Desvíos del spec aceptados en revisión interna (se pide ratificación)
1. Placeholders exportan constante `X_TODO` documentada en vez de archivo vacío.
2. `sameAspectRatio`: tolerancia relativa a `max(r1,r2)` (idéntico resultado en los
   casos del spec).
3. Test 6a: σ=0.75 recortado a ±3px (con σ=1.0 una esquina quedaba a 0.515px del GT;
   sigue siendo "ruido gaussiano ±3px").
4. 2 `it` extra dentro de los grupos 4 y 6 (casos degenerados) para statements ≥90%;
   los 7 grupos se mantienen exactos.

### 2.4 DoD T2
- [x] Scaffolding §8 con dev y test · [x] types.ts con PAPER_SIZES_IN (D1)
- [x] geometry.ts 8 funciones + 6 constantes sin recalcular · [x] 7 grupos verdes
  incl. gate aspect ratios · [x] evidencia + doble revisor interno APROBADO +
  WORKFLOW_STATE actualizado

---

## 3. Veredictos de revisión interna (doble revisor, sin desacuerdo)

| Tarea | Revisor | Revisor-b |
|---|---|---|
| T1-R | APROBADO (15 puntos verificados) | APROBADO |
| T2 | APROBADO (8 criterios) | APROBADO |

---

## 4. Disciplina AGENTS.md — cumplimiento declarado
- `core/` sin DOM ni OpenCV (testeable en Node; entorno vitest = node).
- Cero aspect ratios hardcodeados (solo parámetros + `AR_TOLERANCE`).
- Umbrales de calidad intactos: `quality.ts` es placeholder T3.
- `tests/bench/` intacto (directorio vacío, sin modificaciones).
- Cap 3500px, física de lente 1–2px y no-goals (dewarping/OCR/MRC) sin cambios.
- Nota: `ScanPage.blob?: Blob` es anotación de tipo (borrada en compilación);
  el spec T2 la exige como `blob?`.

## 5. ⚠️ Fuera de alcance de la revisión interna — requiere pronunciamiento
Tras el doble APROBADO aterrizaron en `spike.html` (working tree, sin revisar en
esta sesión) 3 cambios **T1-R2** con evidencia propia en `PLAN_EVIDENCE/T1-R2/`
(`assertions.json`: 5 asserts Playwright pass + `npm test` 20 pass + `tsc` limpio):
1. `spike.html:42` — CSS `#torchBtn.torch-ok { background:#22c55e; }`.
2. `spike.html:183-184` — `refreshDevices()`: el `getUserMedia` temporal ahora guarda
   el stream y detiene sus tracks (cierra leak de cámara).
3. `spike.html:408-430` — `drawQuad`/handles/hit-test: `native2disp(p.x*nw, p.y*nh)`
   con guarda `!nw||!nh` (antes pasaba fracciones 0–1 donde se esperaban px nativos;
   el quad colapsaba a un punto, ver `quad_sin_fix_colapsado` en assertions.json).
Se pide al revisor: (a) validar estos 3 hunks, o (b) excluirlos del alcance y
revisar solo T1-R+T2.

## 6. Estado del árbol (base 4d99e97, sin commits en esta sesión)
- Modificados: `.gitignore`, `.opencode/command/spike.md`,
  `.opencode/skills/{ios-camera-quirks,spike-dispositivos}/SKILL.md`,
  `PLAN_MAESTRO.md`, `WORKFLOW_STATE.md`, `spike.html`, `src/core/types.ts`.
- Nuevos sin trackear: `index.html`, `package.json`, `package-lock.json`,
  `tsconfig.json`, `vite.config.ts`, `src/main.ts`, `src/core/{geometry,quality}.ts`,
  `src/camera/`, `src/scan/`, `src/workers/`, `tests/geometry.test.ts`,
  `tests/quality.test.ts`, `PLAN_EVIDENCE/2026-09-21-{T1-carta,T2-core}/`,
  `PLAN_EVIDENCE/{tareas,T1-R2}/`. (`node_modules/`, `dist/`, `coverage/`,
  `.playwright-mcp/` ignorados.)

## 7. Reproducción (PowerShell, desde la raíz del repo)
```
npx tsc --noEmit            # esperado: exit 0
npm test                    # esperado: 2 ficheros, 20 tests verdes
npm run coverage            # esperado: geometry.ts líneas ≥90%
```
T1-R visual: servir la carpeta (`python -m http.server`) y abrir `spike.html` →
panel "Medición de DPI runtime" debe mostrar `8.5` y `(Carta = 8.5 · A4 = 8.27)`.

## 8. Pendiente humano (no bloquea esta revisión)
Spike F0 en 2–3 dispositivos físicos (incl. iPhone) con hoja carta vertical;
los reportes `.md` resultantes alimentan T3/T5 (CameraController, CornerRefiner,
tabla DPI real).
