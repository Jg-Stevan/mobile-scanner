// src/camera/CameraController.ts — control de cámara (PLAN_MAESTRO §5-F0).
//
// TODO (F0): enumerateDevices() → elegir cámara principal trasera EXPLÍCITA
// (no confiar en facingMode), constraints del <video playsinline muted>,
// torch vía applyConstraints({advanced:[{torch:true}]}) con degradación silenciosa,
// y CameraProfile a partir de getSettings()/getCapabilities() reales.
// Ejecución del instrumento: SOLO humano (spike F0). Sin implementación en T2.
export const CAMERA_CONTROLLER_TODO =
  'enumerateDevices + constraints + torch — F0, PLAN_MAESTRO §5-F0' as const;