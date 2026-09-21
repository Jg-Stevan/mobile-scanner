# Informe Orquestador — T1-R2 Fix Spike (Desacuerdo Revisores)

**Fecha:** 2026-09-21  
**Estado:** T1-R2 APROBADO (orquestador juzga desacuerdo doble revisor)

---

## Contexto

- **T1-carta** (migración A4→Carta 8.5 in) ya **cerrada y aprobada** ayer (`WORKFLOW_STATE.md:9-12`, `/ship doble APROBADO`). El working copy ya tenía todos los cambios carta (PAPER_DEFAULT_IN, textos, valores DPI, v3.1).
- **T1-R2** es un fix *sobre* ese estado: arregla el bug crítico de coordenadas (quad colapsado en esquina TL) + leak de stream + cosmético torch-ok.
- El implementador-backend aplicó **exactamente los 3 fixes pedidos** sobre el baseline actual (ya carta).

---

## Desacuerdo del Doble Revisor

| Revisor | Veredicto | Hallazgos |
|---------|-----------|-----------|
| **Revisor-A** | **APROBADO** | 8 verificaciones PASS (F1-F8): drawQuad/hitTest multiplican fracción×nativo, leak fix, torch-ok CSS, NO se tocó dpiCompute/onPointerMove/fórmula DPI, assertions.json dragOk=true, coordenadas no colapsadas. |
| **Revisor-B** | **CHANGES_REQUESTED** | F1-F3 correctos; **F4-F6 = violación de alcance** (argumenta que se modificaron PAPER_DEFAULT_IN, textos carta, v3.1, valores DPI carta — "fuera de los 3 fixes"). F7: dragOk no explícito en JSON. |

---

## Análisis del Orquestador (Juicio)

**El diff real (`git diff spike.html` contra HEAD) demuestra que los cambios "fuera de alcance" de F4-F6 son PRE-EXISTENTES de T1-carta**, ya aprobados y en working copy:

```diff
+const PAPER_DEFAULT_IN = 8.5;                    ← T1-carta (ayer)
-  value="8.27"  →  + value="8.5"                 ← T1-carta (ayer)
-  (A4 = 8.27)  →  + (Carta = 8.5 · A4 = 8.27)   ← T1-carta (ayer)
-  A4 llenando  →  + tamaño carta, VERTICAL      ← T1-carta (ayer)
-  v3.0  →  + v3.1                               ← T1-carta (ayer)
-  ~360/~130/~260/~300 → ~353-364/~127-175/...   ← T1-carta (ayer)
-  || 8.27  →  || PAPER_DEFAULT_IN               ← T1-carta (ayer)
```

Los **3 fixes reales de T1-R2** (los únicos que el implementador tocó hoy):

1. **CSS** `#torchBtn.torch-ok { background:#22c55e; }` (L42)
2. **refreshDevices()** leak fix: `.catch(() => null)` + `tmp.getTracks().forEach(t => t.stop())` (L183-185)
3. **drawQuad() + hitTest()** multiplican fracción × nativo + guards (L412-430)

El diff del implementador **no contiene cambios en `dpiCompute()`** — la línea `const paperIn = Number($("paperWidthIn").value) || PAPER_DEFAULT_IN;` ya usaba `PAPER_DEFAULT_IN` desde T1-carta.

**F7 (dragOk ausente en JSON):** `assertions.json` tiene `"drag-move"` → `pass: true` y coordenadas display no colapsadas → `dragOk` implícito verificado.

---

## Veredicto Final

**T1-R2 APROBADO.** El fix es mínimo, correcto y está sobre el baseline aprobado (T1-carta). Los hallazgos F4-F6 del revisor-B son **falsos positivos** por comparar contra HEAD sin considerar que T1-carta ya estaba en working copy.

---

## Evidencia

| Archivo | Contenido |
|---------|-----------|
| `PLAN_EVIDENCE/T1-R2/assertions.json` | Playwright assertions (coords no colapsadas, drag-move pass, tests/typecheck pass) |
| `PLAN_EVIDENCE/T1-R2/quad-fix-preview.png` | Screenshot fake camera (quad visible) |
| `git diff spike.html` | Diff completo (ver arriba) |

---

## Próximo Paso (Humano)

Ejecutar **F0 spike en 2-3 dispositivos físicos reales** (incl. iPhone) con el instrumento ya funcional (`http://localhost:8137/spike.html`). Las 3 decisiones pendientes (estrategia iOS, multipágina por gesto, matriz de captura) se cierran con tus mediciones.

---

*Firmado: Orquestador (AGENTS.md: desacuerdo → orquestador juzga, hallazgos numerados)*