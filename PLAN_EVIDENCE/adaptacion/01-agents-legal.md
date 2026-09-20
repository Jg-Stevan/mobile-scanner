# 01 — AGENTS.md legible por los agentes (Fase 1 · T1.1–T1.4)

## T1.1 AGENTS.md — HECHO
Creado `AGENTS.md` con las 7 secciones del plan, transcritas **verbatim** (sin inventar):
1. Fuente de verdad
2. Stack
3. Disciplina obligatoria (violar = CHANGES_REQUESTED)
4. División agente/humano
5. Carpetas prohibidas
6. Flujo de orquestación
7. Limitaciones conocidas del entorno (M1–M3 + locks de Serena)

## T1.2 WORKFLOW_STATE.md — HECHO
Creado con "Tareas Completadas", "Tareas en Progreso" y "Decisiones de Arquitectura"
(arranca con: *"Fuente: PLAN_MAESTRO v3.0 congelado · Fase actual: F0 spike pendiente"*).

## T1.3 Permissions implementador-backend — HECHO
En `~/.config/opencode/agents/implementador-backend.md` el bloque `bash` quedó:
```
"*": ask
"npm test *": allow
"npm run dev *": allow
"npm run build *": allow
"npx tsc *": allow
"npx vitest *": allow
```
Sin `edit: allow` más allá del existente; **no** se escaló a `bash: "*": allow` (R1: reglas por patrón).

## T1.4 Prueba de legibilidad — ⏳ PENDIENTE (checkpoint humano/TUI)
Para verificar:
1. Reiniciar opencode.
2. En TUI: `@explorador` → pregunta **"¿cuál es el cap de resolución y por qué?"**
3. Esperado: respuesta ~**3500px** citando AGENTS.md (`lado largo ~3500px`) y/o PLAN_MAESTRO §5-F3
   ("Cap del lado largo de salida: ~3500px · A4 a 300 DPI reales").

**Estado del checkpoint:** ⏳ T1.4 pendiente.