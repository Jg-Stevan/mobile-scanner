// src/camera/hiResCapture.ts — captura hi-res y EXIF (PLAN_MAESTRO §5-F3).
//
// TODO (F3): rutas A (takePhoto), B (drawImage track), C (input capture manual),
// createImageBitmap con { imageOrientation:'from-image' } → EXIF corregido,
// y re-validación de la foto (nitidez + exposición sobre crop, §5-F3).
// Sin implementación en T2.
export const HI_RES_CAPTURE_TODO =
  'rutas A/B/C + EXIF + re-validación — F3, PLAN_MAESTRO §5-F3' as const;