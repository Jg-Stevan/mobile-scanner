# AGENTS.md — mobile-scanner

## Fuente de verdad
- PLAN_MAESTRO.md (v3.0 CONGELADO): stack, arquitectura, fases,
  no-goals, límites físicos. Los agentes NO re-discuten decisiones;
  proponen cambios vía propuesta documentada, nunca inline.

## Stack
- Vite + TypeScript (strict). Node 24. Tests: vitest (`npm test`,
  `npm test -- <filtro>`). Typecheck: `npx tsc --noEmit`.
- OpenCV.js WASM SOLO dentro de Web Worker (src/workers/)
- src/core/ NO toca DOM (testeable en Node)

## Disciplina obligatoria (del PLAN_MAESTRO — violar = CHANGES_REQUESTED)
- Memoria WASM: TODO cv.Mat dentro de wrapper withMats() con .delete()
  en finally. Test de estrés 10 min tras cambios en worker
- Coordenadas: PROHIBIDO hardcodear aspect ratios (4:3/16:9) — el
  video es un crop del sensor; valores del CameraProfile del spike
- Umbrales de calidad (0.8, 300ms, bandas del refiner): constantes en
  src/core/ — un agente no los inventa ni "afina" sin datos de captura
- Cap de resolución: lado largo ~3500px. Prohibido operar 12MP full
  en hilo principal
- Física aceptada (NO perseguir): distorsión de lente barril, techo
  1-2px CDE en esquinas extremas. NO implementar dewarping/OCR/MRC
  (no-goals del MVP)

## División agente/humano
- Agentes: código, tests, estructura, harness, docs, HTML del spike
- SOLO humano: validación en dispositivos físicos (getUserMedia real),
  llenado de checklist del spike, tabla DPI por dispositivo

## Carpetas prohibidas
- tests/bench/ (set congelado de evaluación — jamás usar para ajustar
  el detector; evita fuga de evaluación)
- PLAN_EVIDENCE/ = SOLO escritura de reportes de evidencia (aclaración aceptada
  por humano 2026-09-22); .opencode/, node_modules/, .git/ intocables

## Flujo de orquestación
- orquestador → explorador → implementador-backend → revisor + revisor-b
- /ship con votación de doble revisor (desacuerdo → orquestador juzga)
- Prefijos: [CONSULT] diagnóstico sin editar · [DELEGATE] cambios autorizados

## Limitaciones conocidas del entorno (workarounds vigentes)
- M1: denylist sudo inoperativa en CLI (riesgo nulo en PowerShell)
- M2: checkpoint plugin solo dispara en TUI → commit manual al cerrar
  sesiones CLI largas
- M3: revisor-b escueto → en desacuerdos pedir findings numerados
- Serena retiene locks en Windows → no borrar archivos recién editados
  por rename_symbol hasta cerrar opencode