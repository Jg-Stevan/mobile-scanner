---
description: Pipeline completo de entrega (implementador, tests, doble revisor A+B) para la tarea descrita.
---

Ship the task described in `$ARGUMENTS` through the full pipeline:

1. Ask `@explorador` for context on the affected module (files + conventions).
2. Delegate the change to `@implementador-backend` with the explorer's file list and the acceptance criteria. It must run `npm test ...` and `npx tsc --noEmit` before returning.
3. Dual review (A + B, INDEPENDENT):
   - Send the implementer's diff to `@revisor` (A). Capture its verdict WITHOUT revealing it to B.
   - Send the SAME diff to `@revisor-b` (B). Must NOT see A's verdict.
   - Both `APPROVED` → task is closed.
   - Disagreement (one APPROVED, one CHANGES_REQUESTED) → YOU act as judge using both reasoned findings; state which prevails and why.
   - Both `CHANGES_REQUESTED` → send the implementer's file back to `@implementador-backend` once with the consolidated findings; if it fails again, stop and report to the user.
4. On task closed: update `WORKFLOW_STATE.md` (Completed) and summarize files changed + tests run + verdicts of A and B.

Failure degradation: if `@revisor` or `@revisor-b` fails (quota/provider), the surviving verdict + your own judgment is sufficient to close (documented in orquestador.md). Never block the pipeline on a dead reviewer.