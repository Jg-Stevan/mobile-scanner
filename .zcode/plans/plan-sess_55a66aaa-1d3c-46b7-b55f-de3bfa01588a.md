## Siguientes pasos

### 1. Anotar la regla aprobada en la política
En `C:\Users\JG\opencode-historial\catalogos\roles-modelos.md`, regla 2 de la economía de tokens: subagente del bucle mecánico **de una sola pasada** — lanza opencode con `--auto` desde el inicio (sin él los permisos "ask" auto-rechazan y se pierde una pasada completa, comprobado en el piloto), corre la verificación y devuelve solo el veredicto; sin permiso para reintentar por su cuenta. Aclaración de las dos cuotas: opencode gasta cuota Zen/opencode; el subagente corre con el modelo de la sesión ZCode (GLM-5.3-Flash) y sus tokens salen de la cuota del plan ZCode — por eso el bucle debe ser estrecho.

### 2. Higiene de WORKFLOW_STATE.md
La línea 101 aún lista F2-c en "Tareas en Progreso" — ya está en Completadas; mover la nota de "re-test humano pendiente" a la sección de verificaciones pendientes para que el estado no duplique.

### 3. TÚ: re-test humano F2-c en dispositivo (bloquea el cierre definitivo)
SM-A566E con acta densa (¿auto dispara <5s?) y documento normal (¿sin disparo espurio al mover?), timeout = solo toast sin vibración, captura = vibra/flash. Si algo falla, me pasas el video y diagnóstico como la vez pasada.

### 4. YO: planificar F3 (recorte preciso) mientras tanto
F3 no depende del re-test de F2-c (es el pipeline de captura→warp, no el disparo):
- Leer la sección F3 del PLAN_MAESTRO y el código actual (`hiResCapture`, rutas A/B/C, geometry.ts) — delegando la exploración ancha a un subagente Explore.
- Escribir `TAREAS/F3.md`: orden de trabajo con la especificación de F3, prohibiciones (umbrales, aspect ratios, tests/bench, withMats) y criterios de aceptación.
- Delegar la implementación a opencode `muse-spark-1.3` vía subagente de una sola pasada (regla del punto 1) y verificar yo mismo.

### No se hace
- No se tocan PLAN_MAESTRO, tests/bench/, .opencode/, umbrales de src/core/
- No se implementa F3 sin tu revisión de la orden de trabajo si hay decisiones de diseño nuevas