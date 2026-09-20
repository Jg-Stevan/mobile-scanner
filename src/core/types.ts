// src/core/types.ts — tipos compartidos (PLAN_MAESTRO §8)
// Sin DOM: testeable en Node.

export interface Corner {
  x: number;
  y: number;
}

/** Cuadrilátero en orden canónico TL, TR, BR, BL. */
export type Quadrilateral = [Corner, Corner, Corner, Corner];

export interface QualityScore {
  total: number;
  sharpness: number;
  exposure: number;
  stability: number;
}

/** Datos medidos en el spike F0 (nunca asumidos). */
export interface CameraProfile {
  deviceLabel: string;
  trackWidth: number;
  trackHeight: number;
  aspectRatio: number;
  capabilities: Record<string, unknown>;
  /** DPI runtime: anchoQuadPx / anchoPapel(in) — medido, no prometido. */
  dpiRuntime: number | null;
  settings: Record<string, unknown>;
}

export interface ScanPage {
  id: string;
  corners: Quadrilateral;
  mode: "color" | "grayscale" | "bw" | "natural";
  /** Blob/URL del resultado warpeado. */
  data: Blob | null;
}
