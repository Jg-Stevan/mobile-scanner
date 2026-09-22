# current_plan.md — Sonda modelos-v2 (tarea trivial)

**Estado:** IN PROGRESS

## Objetivo
Crear el archivo `PLAN_EVIDENCE/sonda-modelos-v2.txt` con el contenido exacto `sonda-v2-ok` siguiendo el pipeline de agentes v2.

## Pipeline de Agentes
1. **Exploración:** `@explorador-v2` explorará el espacio de trabajo para verificar la existencia de la carpeta `PLAN_EVIDENCE` y confirmar que no haya conflictos.
2. **Implementación:** `@implementador-v2` creará el archivo `PLAN_EVIDENCE/sonda-modelos-v2.txt` con el contenido exacto `sonda-v2-ok`.
3. **Revisión Doble:**
   - `@revisor-v2` (Revisor A) revisará la creación del archivo y emitirá su veredicto.
   - `@revisor-b-v2` (Revisor B) revisará la creación del archivo de forma independiente y emitirá su veredicto.

## Verificación
- Confirmar la existencia del archivo `PLAN_EVIDENCE/sonda-modelos-v2.txt`.
- Confirmar que el contenido sea exactamente `sonda-v2-ok`.
- Reportar los agentes que intervinieron y sus veredictos.
