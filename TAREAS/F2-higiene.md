# ORDEN DE TRABAJO — F2-higiene post-F2-c

**Modo:** [DELEGATE] — cambios autorizados, alcance cerrado. No re-discutir
PLAN_MAESTRO ni decisiones aprobadas.

## Contexto mínimo

Repo: scanner móvil (Vite + TS strict). F2-c (criterio k-de-n de disparo) ya
está COMPLETADA y aprobada (/ship doble, 156/156 tests, tsc limpio). Esta tarea
es SOLO higiene del diff pendiente de commit. No cambies ninguna constante,
ninguna firma ni ninguna lógica.

## Cambios exactos (solo estos)

### 1. `src/core/quality.ts` — arreglar indentación de 2 comentarios JSDoc

Las líneas 111-112 y 134-137 tienen un espacio extra antes del `*` de
continuación (quedaron `  *  ` en vez de ` *  `). Dejarlas alineadas con la
línea de apertura del bloque. Ejemplo del estado deseado:

```
 *  under = píxeles con valor < UNDER_EXPOSED_PX; over = valor > OVER_EXPOSED_PX.
 *  score = 1 − (under + over). specularRatio = fracción > SPECULAR_PX. */
```

Líneas afectadas: 111, 112, 134, 135, 136 (si tiene el espacio extra), 137.
NO tocar el texto, solo la indentación.

### 2. `tests/quality.test.ts` — eliminar código muerto

Líneas 220-221, dentro del test 'excentricidad 0.3 sostenida → sigue sin
disparar':

```ts
    const t = new Float32Array([0.0, 0.2, 0.9, 0.2, 0.9, 0.8, 0.0, 0.8]);
    void t;
```

Borrar ambas líneas. No sobra ninguna variable en ese test sin ellas.

### 3. Crear `PLAN_EVIDENCE/F2-c/reporte-F2-c.md`

WORKFLOW_STATE.md lo referencia pero la carpeta no existe. Redactar el reporte
de evidencia a partir de lo que dice WORKFLOW_STATE.md (sección F2-c) y de los
comentarios `F2-c` en `src/core/quality.ts`: criterio k-de-n (K=4 de N=6 en
1200ms, última muestra buena, reemplaza racha continua 600ms de F2-b),
retención de scoreHistory a SHUTTER_SPAN_MS+200=1400ms, timeout sin vibrar,
flash iOS del harness, 156/156 tests, tsc limpio, re-test humano PENDIENTE
(acta densa + documento normal). Formato: igual que `PLAN_EVIDENCE/F2/reporte-F2.md`.

## PROHIBIDO

- Tocar `tests/bench/`, `PLAN_EVIDENCE/` (excepto CREAR el reporte del punto 3),
  `.opencode/`, `node_modules/`, `.git/`, `PLAN_MAESTRO.md`
- Cambiar constantes, umbrales, lógica, firmas o nombres
- `git commit` / `git add` — el commit es manual del humano
- Reformatear archivos completos (solo los cambios listados)

## Criterios de aceptación (el orquestador los verifica)

1. `npx tsc --noEmit` sin errores
2. `npm test` → 156/156 en verde
3. `git diff --stat` muestra SOLO: `src/core/quality.ts`, `tests/quality.test.ts`
   (ya modificados) y el nuevo `PLAN_EVIDENCE/F2-c/reporte-F2-c.md`

## Reporte de cierre

Al terminar, imprime: (a) lista de archivos cambiados, (b) resultado de
`npm test` (última línea) y `npx tsc --noEmit`, (c) cualquier desviación de
esta orden y por qué.
