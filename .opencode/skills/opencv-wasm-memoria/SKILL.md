---
name: opencv-wasm-memoria
description: Use whenever coding or reviewing anything that touches cv.Mat or the detection Web Worker (detection.worker.ts). Enforces withMats() wrapper discipline, cv.Mat lifecycle in worker, and the 10-minute stress test procedure. Violations = CHANGES_REQUESTED.
---

# OpenCV.wasm Memory Discipline

Fuente de verdad: PLAN_MAESTRO v3.0, secciones 3, 9 y métricas de aceptación §7 ("0 leaks tras 10 min continuos; picos <150MB").

## Regla no negociable

TODO `cv.Mat` (y `cv.MatVector`) DEBE nacer dentro de un wrapper `withMats()` que ejecute `.delete()` en `finally`. Nada de `.delete()` manual suelto ni confiar en GC del navegador (no ve los Mats).

## Wrapper de referencia

```typescript
// src/workers/withMats.ts
type MatLike = { delete(): void };

export function withMats<T>(cv: any, fn: (tracker: (m: MatLike) => void) => T): T {
  const tracked: MatLike[] = [];
  const tracker = (m: MatLike) => tracked.push(m);
  try {
    return fn(tracker);
  } finally {
    // late-finalizar: el API de OpenCV.js delete-despues-de-uso pide
    // orden LIFO; barrido simple es seguro porque ya no se tocan
    for (let i = tracked.length - 1; i >= 0; i--) tracked[i].delete();
  }
}
```

Uso en el worker (el tracker registra cada `cv.Mat`; los `MatVector` también):

```typescript
const result = withMats(cv, (track) => {
  const src = cv.matFromImageData(imageData); track(src);
  const dst = new cv.Mat(); track(dst);
  const contours = new cv.MatVector(); track(contours);
  const hierarchy = new cv.Mat(); track(hierarchy);
  // ...si aquí se lanza, finally limpia; early-return idem
  cv.findContours(dst, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  return { corners: extractTopQuadrilateral(contours) };
});
```

## Ciclo de vida del Mat en el worker

1. Cada mensaje `{ type:'detect', bitmap }` crea Mats de vida corta: `matFromImageData`, `dst`, `MatVector`, `hierarchy`.
2. Todo intento de `.delete()` debe estar garantizado incluso en:
   - **early-return** (contorno no cerrado, `approxPolyDP` sin 4 vértices)
   - **excepción** antes del `finally` (apagón del cv.Mat en medio del pipeline)
3. El patrón correcto: recolectar los Mats en una lista y `deleteAll()` dentro del `finally` del bloque que puede lanzar.

## Errores comunes (causa raíz de leaks)

- `Mat` creado y `.delete()` solo en la rama feliz.
- `MatVector` no borrado (contenedores que guardan punteros a Mats).
- Excepción lanzada entre creación y `.delete()`.
- Reutilizar un `Mat` como dst sin `.delete()` del resultado anterior (Canny en-place está bien; `warpPerspective` con dst nuevo no).

## Procedimiento del test de estrés (obligatorio tras tocar el worker)

1. Loop de detección continua **10 minutos** (`npm test` dedicado o harness que envía `detect` a 30 fps simulados).
2. Medir en el worker, cada 60s:
   - `performance.memory.usedJSHeapSize` (Chrome) — el worker es un hilo ejecutor de WASM, mídelo ahí.
   - `WebAssembly.Memory` del módulo OpenCV: `cv.memory`/buffer byteLength (crecimiento = Mats que quedaron vivos).
   - En el hilo principal, `performance.memory.totalJSHeapSize` como correlato.
3. **Criterio de fallo (leak):** crecimiento sostenido del heap o de la memoria WASM después del periodo de estabilización (primeros ~2 min), sin tocar techo plano. Meta del PLAN_MAESTRO: **crecimiento < 50MB** tras 10 min y picos <150MB.
4. Si crece: buscar el Mat sin delete del primer frame sospechoso. No "arreglar afuera" con `cv.matFromImageData` de mayor lifetime.

## Referencia al riesgo

PLAN_MAESTRO §9: "Leaks WASM — Prob. Media — Mitigación: withMats() + estrés 10min". Un leak en un loop a 30fps mata la pestaña en minutos (móviles de 3GB).