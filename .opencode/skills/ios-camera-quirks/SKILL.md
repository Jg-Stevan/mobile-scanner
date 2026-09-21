---
name: ios-camera-quirks
description: Use whenever implementing or reviewing anything related to camera capture on iOS/Safari: capture routes A/B/C, video element requirements, EXIF orientation, torch, storage.persist for IndexedDB, or haptic feedback. Extracted from PLAN_MAESTRO v3.1 sections 4 and 5.
---

# iOS Camera Quirks

Fuente de verdad: PLAN_MAESTRO v3.1, secciones 4 y 5.

## Rutas de captura hi-res — cuándo aplica cada una

| Ruta | Implementación | Aplica en | DPI efectivo (Carta llenando encuadre) |
|---|---|---|---|
| **A: `ImageCapture.takePhoto()`** | Dispara autofoco/exposición del hardware | Chrome / Android | **~353–364 DPI** (12MP, 3000×4000) — ruta de calidad |
| **B: `drawImage` del track** | Pausar video, `drawImage` a canvas | Safari / iOS **auto** | ~127–175 DPI (1080p) · ~254–349 DPI si `getSettings()` confirma 4K (2160) |
| **C: `<input capture>` manual** | Pick nativo de cámara, sensor completo | Safari / iOS **manual FULL-RES** | **~356+ DPI** — es la ruta de calidad en iOS, con UX de primera clase (no un escape) |

Regla de diseño: el `CameraProfile` calcula y loguea DPI en runtime (`anchoQuadPx / 8.5` — Carta, D1; A4 = 8.27 alternativa). El copy de producto NO promete calidad uniforme entre plataformas.

## `enumerateDevices()` — elegir cámara principal explícita

No confiar en `facingMode`: puede agarrar el teleobjetivo o el ultra-wide. Seleccionar la **cámara principal trasera explícita** del resultado de `enumerateDevices()`.

## Requisitos del elemento `<video>`

- **`playsinline muted` obligatorio** (iOS no reproduce inline sin esto).
- Preview a `object-fit: contain` (con `cover` el polígono del overlay queda desplazado).

## Orientación EXIF — Safari

- `createImageBitmap(blob, { imageOrientation: 'from-image' })` **en Safari** para respetar el EXIF de la foto.
- Es el paso intermedio obligatorio del pipeline de captura: `blob → createImageBitmap(from-image) → re-detección/refiner`.

## Torch / linterna

```typescript
const caps = track.getCapabilities();
if (caps.torch) {
  await track.applyConstraints({ advanced: [{ torch: true }] });
}
```

- Solo si `capabilities.torch` existe.
- **Degradación silenciosa en iOS**: si `applyConstraints` no soporta torch, no romper — el CLAHE posterior mitiga la iluminación.
- Verificar también `focusMode` en capabilities.

## IndexedDB: `storage.persist()` + `estimate()`

iOS purga IndexedDB de PWAs poco usadas. Antes de guardar páginas:

```typescript
const persisted = await navigator.storage.persist();
const { usage, quota } = await navigator.storage.estimate();
```

Avisar al usuario si la cuota está apretada o hay páginas sin exportar.

## Haptics: `navigator.vibrate` NO existe en iOS

- Android: `navigator.vibrate(50)` al disparar.
- iOS: **flash visual del overlay** como feedback de captura (no usar vibrate a ciegas).

## Referencias del maestro

- Sección 4: tabla de DPI honestos por plataforma y consecuencia de diseño del `CameraProfile`.
- Sección 5 · F0 construcción: `enumerateDevices`, `<video>`, `CameraProfile`, torch, bucle rVFC.
- Sección 5 · F3: `createImageBitmap(blob, {imageOrientation:'from-image'})` en el flujo de captura.
- Sección 5 · F5 y §9 (riesgo "iOS purga IndexedDB"): `persist()` + avisar exportar.