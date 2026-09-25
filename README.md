# mobile-scanner

Digitalizador de documentos 100% navegador (sin servidor): captura, detección de bordes, warp, enhance y PDF multipágina. Vite + TypeScript strict + OpenCV.js WASM en Web Worker.

**Documentos del sistema:**
- [PLAN_MAESTRO.md](PLAN_MAESTRO.md) — plan v3.1 congelado: stack, arquitectura, fases, no-goals.
- [WORKFLOW_STATE.md](WORKFLOW_STATE.md) — bitácora viva: tareas, decisiones (D1–D8), matriz de dispositivos.
- [AGENTS.md](AGENTS.md) — contrato de conducta para agentes.
- [DOSSIER-IA.md](DOSSIER-IA.md) — briefing autocontenido para una IA externa (navegador, sin acceso al repo).

```bash
npm test        # Vitest (314 tests)
npx tsc --noEmit
```
