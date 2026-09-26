// src/ui/AdjustEditor.ts — editor manual de esquinas F4 (orden F4, punto 1).
// Canvas con la foto CRUDA en preview (~1600 lado largo); los handles viven
// en FRACCIONES del ORIGINAL (nunca en px del canvas: el preview puede ser
// pequeño sin perder precisión — patrón displayRect portado del spike/harness
// F3). Loupe 3× circular con crosshair mientras se arrastra. Badge por lado
// si needsEditorReview(...) del CornerRefiner es true. API: open / onConfirm
// / onRevert / close. Deps inyectables (canvas, contenedor, fabricador de
// preview) — sin DOM global. La matemática es pura y testeable (Node).
//
// Constantes nuevas SOLO estas tres (orden F4, cada una con origen abajo).

import type { Quadrilateral } from '../core/types';
import { validateQuad } from '../core/geometry';
import { displayRect, type DisplayRect } from './ScannerView';

/** Lado mayor del preview del editor (orden F4 punto 1: "preview downscale
 *  ~1600 lado largo"). Mismo valor que TRAINING_LONG_SIDE por la misma razón
 *  de recursos (dibujar la foto completa 12MP en el canvas de edición derrocha
 *  memoria del hilo principal; los handles en fracciones hacen el preview
 *  inmune al downscale). 1600 es suficiente para ver los bordes del documento
 *  y ajustar esquinas al sub-píxel (fracciones se convierten a px del ORIGINAL
 *  al confirmar). */
export const EDITOR_PREVIEW_LONG_SIDE = 1600;

/** Inseto por defecto de las esquinas del editor (orden F4 punto 2: "quad null
 *  → editor abre con defaults 20% dentro bordes"): documento sin detección =
 *  rectángulo al 20% del borde (0.2,0.2)/(0.8,0.2)/(0.8,0.8)/(0.2,0.8).
 *  Origen: aprobación humana F4 (2026-09-24); el usuario lo ajusta antes de
 *  confirmar, así que es solo un punto de partida seguro. */
export const EDITOR_DEFAULT_INSET = 0.2;

/** Zoom del loupe (orden F4 punto 1: "Loupe 3× circular") + radio del loupe
 *  en px CSS (diámetro 2·radio; valor razonable para no tapar el handle). */
export const EDITOR_LOUPE_SCALE = 3;
export const EDITOR_LOUPE_RADIUS = 84;

/** Tamaño táctil mínimo de los handles (orden F4 punto 1: "4 handles ≥44px
 *  touch") — el radio de hit/dibujo es touchPadPx/2. */
export const EDITOR_TOUCH_PX = 44;

/** Radio de snap de esquinas al recorte manual, como fracción del lado largo
 *  de la foto (2026-09-26, petición humana — patrón Adobe Scan: acercar el
 *  handle a la esquina detectada la ajusta sola). 4% del lado largo ≈ 160px
 *  en una foto de 4000px: đủ precisión para "apuntar" sin robar el control. */
export const EDITOR_SNAP_RADIUS_FRACTION = 0.04;

/** Tras N gestos de arrastre del usuario el snap se DESACTIVA para esa sesión
 *  del editor (petición humana 2026-09-26: "si se modifica más de 3 veces por
 *  el usuario no insistir — puede que no esté alineado con lo que quiere"). */
export const EDITOR_SNAP_MAX_GESTURES = 3;

// ---------------------------------------------------------------------------
// Matemática pura (testeada en tests/adjustEditor.test.ts)
// ---------------------------------------------------------------------------

/** Dims del preview (contain): lado mayor → EDITOR_PREVIEW_LONG_SIDE. */
export function previewDims(
  w: number,
  h: number,
  longSide: number = EDITOR_PREVIEW_LONG_SIDE,
): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 0, h: 0 };
  const s = longSide / Math.max(w, h);
  if (s >= 1) return { w, h };
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Esquinas por defecto en fracciones (TL,TR,BR,BL al inset 0.2). */
export function defaultQuadFractions(inset: number = EDITOR_DEFAULT_INSET): Float32Array {
  const i = Math.min(0.49, Math.max(0, inset)); // clamp defensivo: nunca >49% (quad no vacío)
  return new Float32Array([i, i, 1 - i, i, 1 - i, 1 - i, i, 1 - i]);
}

/** Clamp de una fracción al rango [0,1] (la foto). */
export function clampFraction(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/** Fracciones iniciales del editor: ajustado previo (si reabre tras un edit)
 *  → refinado → detección → defaults 0.2. Siempre clampadas a la foto. */
export function initialQuadFractions(photo: {
  quad: Quadrilateral | null;
  quadRefined: Quadrilateral | null;
  adjustedQuad?: Quadrilateral | null;
  frameW: number;
  frameH: number;
}): Float32Array {
  const raw = photo.adjustedQuad ?? photo.quadRefined ?? photo.quad;
  if (raw === null || !(photo.frameW > 0) || !(photo.frameH > 0)) {
    return defaultQuadFractions();
  }
  const out = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    const x = raw[i]!.x;
    const y = raw[i]!.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return defaultQuadFractions();
    out[2 * i] = clampFraction(x / photo.frameW);
    out[2 * i + 1] = clampFraction(y / photo.frameH);
  }
  return out;
}

/** Handle (fracción) → posición display (px del canvas). */
export function fractionsToDisplay(
  fx: number,
  fy: number,
  r: DisplayRect,
): { x: number; y: number } {
  return { x: r.x + clampFraction(fx) * r.w, y: r.y + clampFraction(fy) * r.h };
}

/** Punto display (px del canvas) → fracción de la foto (clampada). */
export function displayToFractions(
  dx: number,
  dy: number,
  r: DisplayRect,
): { x: number; y: number } {
  if (!(r.w > 0) || !(r.h > 0)) return { x: 0, y: 0 };
  return { x: clampFraction((dx - r.x) / r.w), y: clampFraction((dy - r.y) / r.h) };
}

/** Hit-test de los 4 handles: índice tocado (≤ touchPadPx/2 de distancia en
 *  px display) o -1. NaN en la entrada → -1. */
export function hitTestHandle(
  px: number,
  py: number,
  fractions: Float32Array,
  r: DisplayRect,
  touchPadPx: number = EDITOR_TOUCH_PX,
): number {
  if (!Number.isFinite(px) || !Number.isFinite(py) || fractions.length !== 8) return -1;
  const hitR = Math.max(1, touchPadPx / 2);
  for (let i = 0; i < 4; i++) {
    const h = fractionsToDisplay(fractions[2 * i]!, fractions[2 * i + 1]!, r);
    if (Math.hypot(px - h.x, py - h.y) <= hitR) return i;
  }
  return -1;
}

/** Cuadrado (en px display) del loupe: círculo radio `radius` → bbox. */
export function loupeRect(
  cx: number,
  cy: number,
  radius: number = EDITOR_LOUPE_RADIUS,
): { x: number; y: number; w: number; h: number } {
  const r = Math.max(1, radius);
  return { x: cx - r, y: cy - r, w: 2 * r, h: 2 * r };
}

/** Centro del loupe (F4 validación humana 2026-09-25: "la lupa aparece debajo
 *  del dedo — que aparezca en el lado opuesto"): se dibuja en el lado VERTICAL
 *  opuesto al handle (arriba por defecto; abajo si el círculo no cabe arriba).
 *  X clampeada al canvas. La FUENTE sigue centrada en el handle: el crosshair
 *  del loupe marca siempre el punto de corte real. Función pura (testeable). */
export function loupeCenter(
  hx: number,
  hy: number,
  canvasW: number,
  canvasH: number,
  radius: number = EDITOR_LOUPE_RADIUS,
  gap: number = 14,
): { x: number; y: number } {
  const r = Math.max(1, radius);
  const x = Math.min(Math.max(hx, r), Math.max(r, canvasW - r));
  const y = hy - (r + gap);
  if (y - r >= 0) return { x, y };
  return { x, y: Math.min(hy + r + gap, Math.max(r, canvasH - r)) };
}

/** Badges de revisión por lado (orden F4 punto 1: "Badge por lado si
 *  needsEditorReview true"): fellBack null = sin info del refine → TODOS los
 *  lados piden revisión (criterio del helper needsEditorReview del
 *  CornerRefiner: null = desconocido → revisar). Si no, badge = lado caído. */
export function sideReviewBadges(
  fellBack: [boolean, boolean, boolean, boolean] | null,
): [boolean, boolean, boolean, boolean] {
  if (fellBack === null) return [true, true, true, true];
  return fellBack;
}

/** Fracciones (Float32Array TL,TR,BR,BL) → quad EN PÍXELES de la foto
 *  (contrato de onConfirm: igual que CapturedPhoto.quad). */
export function fractionsToQuadPx(
  fractions: Float32Array,
  frameW: number,
  frameH: number,
): Quadrilateral {
  return [
    { x: fractions[0]! * frameW, y: fractions[1]! * frameH },
    { x: fractions[2]! * frameW, y: fractions[3]! * frameH },
    { x: fractions[4]! * frameW, y: fractions[5]! * frameH },
    { x: fractions[6]! * frameW, y: fractions[7]! * frameH },
  ];
}

/** Esquina auto-detectada (fracciones) → quad en fracciones (TL,TR,BR,BL).
 *  Targets del snap: SIEMPRE el auto (quadRefined ?? quad), nunca adjustedQuad
 *  — el snap imita la detección, no el ajuste previo del humano. */
export function autoQuadFractions(photo: {
  quad: Quadrilateral | null;
  quadRefined: Quadrilateral | null;
  frameW: number;
  frameH: number;
}): Float32Array | null {
  const raw = photo.quadRefined ?? photo.quad;
  if (raw === null || !(photo.frameW > 0) || !(photo.frameH > 0)) return null;
  const out = new Float32Array(8);
  for (let i = 0; i < 4; i++) {
    const x = raw[i]!.x;
    const y = raw[i]!.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    out[2 * i] = clampFraction(x / photo.frameW);
    out[2 * i + 1] = clampFraction(y / photo.frameH);
  }
  return out;
}

/** Snap de la esquina arrastrada (fx,fy) a la esquina auto-detectada más
 *  cercana DENTRO del radio (fracción del lado largo de la foto, medida en px
 *  de foto — anisotrópico correcto en fotos no cuadradas). null = sin snap:
 *  el handle sigue al dedo. Pura y testeable (2026-09-26, petición humana). */
export function snapCorner(
  fx: number,
  fy: number,
  targets: Float32Array | null,
  radiusFraction: number,
  frameW: number,
  frameH: number,
): { x: number; y: number } | null {
  if (targets === null || targets.length !== 8) return null;
  const longSide = Math.max(frameW, frameH);
  if (!(longSide > 0) || !(radiusFraction > 0)) return null;
  const radiusPx = radiusFraction * longSide;
  let best: { x: number; y: number } | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < 4; i++) {
    const tx = targets[2 * i]!;
    const ty = targets[2 * i + 1]!;
    const d = Math.hypot((fx - tx) * frameW, (fy - ty) * frameH);
    if (d <= radiusPx && d < bestDist) {
      bestDist = d;
      best = { x: tx, y: ty };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Clase (DOM ligera; contexto inyectado; sin document global)
// ---------------------------------------------------------------------------

export interface AdjustEditorCallbacks {
  /** quad en PÍXELES de foto (TL,TR,BR,BL) — el harness lo envía a
   *  orch.submitEditedQuad. */
  onConfirm(quad: Quadrilateral): void;
  /** Usuario pidió revertir: el harness resetea (re-warp con el quad auto). */
  onRevert(): void;
}

export interface AdjustEditorOptions {
  callbacks: AdjustEditorCallbacks;
  /** Overlay del editor (se muestra en open(), se oculta en close()). */
  root: HTMLElement;
  /** Canvas donde se dibuja foto + handles + loupe. */
  canvas: HTMLCanvasElement;
  /** Fabricador del preview (inyectable/testeable): a partir del bitmap
   *  crudo, el canvas a previewDims. Default: drawImage escalado una vez. */
  makePreview?: (bitmap: ImageBitmap, w: number, h: number) => Promise<HTMLCanvasElement>;
  /** Tamaño táctil de hit (px); default EDITOR_TOUCH_PX (≥44 del orden). */
  touchPadPx?: number;
}

/** Editor F4. NO usa document/navigator globales: todo llega por el
 *  constructor (patrón T5). open() dibuja; onConfirm()/onRevert()/close()
 *  orquestan el flujo con el FSM vía callbacks. */
export class AdjustEditor {
  private readonly callbacks: AdjustEditorCallbacks;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly makePreview: NonNullable<AdjustEditorOptions['makePreview']>;
  private readonly touchPadPx: number;
  private ctx: CanvasRenderingContext2D | null;
  private photo: {
    bitmap: ImageBitmap;
    frameW: number;
    frameH: number;
  } | null = null;
  private fellBack: [boolean, boolean, boolean, boolean] | null = null;
  private fractions = defaultQuadFractions();
  private preview: HTMLCanvasElement | null = null;
  private dragIndex: number | null = null;
  /** Esquinas auto-detectadas (targets del snap); null = captura sin detección
   *  → sin snap. Se recalcula en cada open(). */
  private autoTargets: Float32Array | null = null;
  /** Gestos de arrastre completados en ESTA sesión del editor: al llegar a
   *  EDITOR_SNAP_MAX_GESTURES el snap se desactiva (el humano manda). */
  private gestures = 0;
  /** true mientras el handle arrastrado esté snapsheado a un target. */
  private snapped = false;

  constructor(opts: AdjustEditorOptions) {
    this.callbacks = opts.callbacks;
    this.root = opts.root;
    this.canvas = opts.canvas;
    this.touchPadPx = Math.max(44, opts.touchPadPx ?? EDITOR_TOUCH_PX);
    this.makePreview =
      opts.makePreview ??
      (async (bitmap, w, h) => {
        const c = this.canvas.ownerDocument.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        try {
          if (ctx !== null) ctx.drawImage(bitmap, 0, 0, w, h);
        } catch (err) {
          // Guard detached-bitmap (2026-09-26): un bitmap cerrado por el
          // ciclo de vida del harness no debe matar el editor con una
          // excepción críptica del navegador.
          throw new Error('La captura fue cerrada — reabre el editor desde la captura actual', {
            cause: err,
          });
        }
        return c;
      });
    this.ctx = this.canvas.getContext('2d');
    this.bindPointer();
  }

  /** Abre el editor sobre una captura (mismo shape que CapturedPhoto — el
   *  harness pasa la foto tal cual). `fellBack` = lados caídos del refine
   *  (lo captura el dep requestWarp del harness; null = sin info → todos los
   *  lados badge, igual que needsEditorReview(null)). Los handles iniciales =
   *  ajustado previo → refinado → detección → defaults 0.2. */
  async open(
    photo: {
      bitmap: ImageBitmap;
      quad: Quadrilateral | null;
      quadRefined: Quadrilateral | null;
      adjustedQuad?: Quadrilateral | null;
      frameW: number;
      frameH: number;
    },
    fellBack: [boolean, boolean, boolean, boolean] | null = null,
  ): Promise<void> {
    this.photo = photo;
    this.fellBack = fellBack;
    this.fractions = initialQuadFractions(photo).slice();
    // Snap (2026-09-26): targets = esquinas de la DETECCIÓN automática. Cada
    // open() es una sesión nueva → contador de gestos a cero.
    this.autoTargets = autoQuadFractions(photo);
    this.gestures = 0;
    this.snapped = false;
    const d = previewDims(photo.frameW, photo.frameH);
    this.preview = await this.makePreview(photo.bitmap, d.w, d.h);
    this.root.hidden = false;
    this.syncCanvasSize();
    this.render();
  }

  /** Confirma: convierte las fracciones actuales → px de foto y llama al
   *  callback (el FSM re-warpéa con submitEditedQuad). El cierre lo decide el
   *  caller después de conocer el resultado. */
  onConfirm(): void {
    if (this.photo === null) return;
    this.callbacks.onConfirm(fractionsToQuadPx(this.fractions, this.photo.frameW, this.photo.frameH));
  }

  /** Revierte: resetea los handles a las esquinas automáticas (ajustado no) y
   *  avisa al harness (re-warp con el quad auto — submitEditedQuad NO se
   *  invoca; el FSM sigue 'editing'). */
  onRevert(): void {
    this.callbacks.onRevert();
    // El harness devuelve el quad auto; el editor lo refleja en el siguiente
    // open() — aquí solo se limpia la selección de arrastre.
    this.dragIndex = null;
  }

  /** Cierra el editor (sin confirmar; el FSM vuelve vía cancelEditing). */
  close(): void {
    this.dragIndex = null;
    this.root.hidden = true;
    if (this.preview !== null) {
      const p = this.preview;
      this.preview = null;
      // Descartar el canvas preview: se recrea en el próximo open().
      p.width = 1;
      p.height = 1;
    }
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /** Fracciones actuales (expuesto para el harness/test; lectura). */
  getFractions(): Float32Array {
    return this.fractions.slice();
  }

  // --- internals ---

  private syncCanvasSize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = Math.max(1, w);
      this.canvas.height = Math.max(1, h);
    }
  }

  private display(): DisplayRect {
    if (this.photo === null) return { x: 0, y: 0, w: this.canvas.width, h: this.canvas.height };
    return displayRect(this.canvas.width, this.canvas.height, this.photo.frameW, this.photo.frameH);
  }

  private render(): void {
    const ctx = this.ctx;
    if (ctx === null || this.photo === null) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const r = this.display();
    ctx.clearRect(0, 0, w, h);

    // Foto cruda (preview) contenida.
    if (this.preview !== null) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.preview, r.x, r.y, r.w, r.h);
    }
    // Máscara fuera del quad (resalta el documento).
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.moveTo(r.x + this.fractions[0]! * r.w, r.y + this.fractions[1]! * r.h);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(r.x + this.fractions[2 * i]! * r.w, r.y + this.fractions[2 * i + 1]! * r.h);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill('evenodd');

    // Polígono. F4 validación humana (2026-09-25): quad inválido (cruzado/
    // degenerado) → borde ROJO + banner: el "confirm" que no respondía era un
    // 'invalid' con toast INVISIBLE bajo este overlay (z-index 50). Aquí el
    // feedback vive DENTRO del editor y es en vivo mientras se arrastra.
    const valid = this.quadIsValid();
    ctx.strokeStyle = valid ? '#eab308' : '#ef4444';
    ctx.lineWidth = valid ? 2 : 3;
    ctx.beginPath();
    ctx.moveTo(r.x + this.fractions[0]! * r.w, r.y + this.fractions[1]! * r.h);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(r.x + this.fractions[2 * i]! * r.w, r.y + this.fractions[2 * i + 1]! * r.h);
    }
    ctx.closePath();
    ctx.stroke();

    // Badges por lado (punto medio del lado; color de aviso si pide revisión).
    // F4 validación humana (2026-09-25): SOLO se dibujan con info REAL del
    // refine (fellBack !== null). Con null (captura manual sin refine) los 4
    // badges ámbar parecían "handles de alto/ancho que no funcionan" — sin
    // info de refine no hay nada que señalar y se omiten.
    const badges = sideReviewBadges(this.fellBack);
    const showBadges = this.fellBack !== null;
    const mid = (i: number) => {
      const x1 = r.x + this.fractions[2 * i]! * r.w;
      const y1 = r.y + this.fractions[2 * i + 1]! * r.h;
      const x2 = r.x + this.fractions[2 * ((i + 1) % 4)]! * r.w;
      const y2 = r.y + this.fractions[2 * ((i + 1) % 4) + 1]! * r.h;
      return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    };
    for (let i = 0; showBadges && i < 4; i++) {
      const m = mid(i);
      const needReview = badges[i] === true;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = needReview ? '#f59e0b' : '#333';
      ctx.fill();
      ctx.strokeStyle = needReview ? '#fde68a' : '#666';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (needReview) {
        ctx.fillStyle = '#111';
        ctx.font = '700 11px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), m.x, m.y + 1);
      }
    }

    // Handles: ≥44px táctiles (radio = touchPadPx/2). El handle snapsheado se
    // pinta VERDE (2026-09-26): feedback de "esquina de página tomada".
    for (let i = 0; i < 4; i++) {
      const hp = fractionsToDisplay(this.fractions[2 * i]!, this.fractions[2 * i + 1]!, r);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y, this.touchPadPx / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill();
      const isSnapped = this.dragIndex === i && this.snapped;
      ctx.strokeStyle = isSnapped ? '#22c55e' : this.dragIndex === i ? '#eab308' : '#111';
      ctx.lineWidth = this.dragIndex === i ? 4 : 2;
      ctx.stroke();
    }

    // Banner de quad inválido (encima de todo, dentro del canvas — el toast
    // del harness queda bajo este overlay: ver nota en el polígono).
    // 2026-09-26 (petición humana): DEJA de bloquear — una captura trocida se
    // puede guardar; el orchestrator re-warpéa con el bounding box y avisa.
    if (!valid) {
      const msg = 'Quad inválido — se guardará el recuadro ajustado (bounding box)';
      ctx.font = '700 13px system-ui, sans-serif';
      const tw = ctx.measureText(msg).width;
      const bw = Math.min(w - 16, tw + 24);
      const bh = 36;
      const bx = (w - bw) / 2;
      const by = 10;
      const rr = 8;
      ctx.fillStyle = 'rgba(239,68,68,0.94)';
      ctx.beginPath();
      ctx.moveTo(bx + rr, by);
      ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
      ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
      ctx.arcTo(bx, by + bh, bx, by, rr);
      ctx.arcTo(bx, by, bx + bw, by, rr);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(msg, w / 2, by + bh / 2, bw - 16);
    }
  }

  /** ¿El quad actual es confirmable? (validación EN VIVO — F4 validación
   *  humana 2026-09-25: el 'invalid' silencioso del orchestrator + toast bajo
   *  el overlay = "botón confirmar muerto". Con este gate el editor lo pinta
   *  antes de intentar confirmar). */
  private quadIsValid(): boolean {
    if (this.photo === null) return false;
    const q = fractionsToQuadPx(this.fractions, this.photo.frameW, this.photo.frameH);
    return validateQuad(q, this.photo.frameW, this.photo.frameH);
  }

  /** Loupe 3× (recorta preview alrededor del handle arrastrado) + crosshair.
   *  Solo vive durante el arrastre. Dibujado en el lado opuesto del dedo
   *  (loupeCenter) — F4 validación humana 2026-09-25. */
  private renderLoupe(): void {
    const ctx = this.ctx;
    if (ctx === null || this.photo === null || this.preview === null || this.dragIndex === null) {
      return;
    }
    const i = this.dragIndex;
    const r = this.display();
    const hp = fractionsToDisplay(this.fractions[2 * i]!, this.fractions[2 * i + 1]!, r);
    const lc = loupeCenter(hp.x, hp.y, this.canvas.width, this.canvas.height);
    const lr = { x: lc.x - EDITOR_LOUPE_RADIUS, y: lc.y - EDITOR_LOUPE_RADIUS, w: 2 * EDITOR_LOUPE_RADIUS, h: 2 * EDITOR_LOUPE_RADIUS };
    // Región fuente: radio del loupe dividido por el zoom, en px del preview.
    const srcPxPerCss = this.preview.width / r.w;
    const srcDiam = (lr.w / EDITOR_LOUPE_SCALE) * srcPxPerCss;
    const sx = clampFraction(this.fractions[2 * i]!) * this.preview.width;
    const sy = clampFraction(this.fractions[2 * i + 1]!) * this.preview.height;
    ctx.save();
    ctx.beginPath();
    ctx.arc(lc.x, lc.y, EDITOR_LOUPE_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(lr.x, lr.y, lr.w, lr.h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      this.preview,
      sx - srcDiam / 2,
      sy - srcDiam / 2,
      srcDiam,
      srcDiam,
      lr.x,
      lr.y,
      lr.w,
      lr.h,
    );
    // Crosshair centrado en el loupe: marca el punto de corte real (el
    // handle), ahora visible en el lado opuesto del dedo.
    ctx.strokeStyle = 'rgba(234,179,8,0.95)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lc.x, lr.y);
    ctx.lineTo(lc.x, lr.y + lr.h);
    ctx.moveTo(lr.x, lc.y);
    ctx.lineTo(lr.x + lr.w, lc.y);
    ctx.stroke();
    ctx.restore();
  }

  private bindPointer(): void {
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (this.photo === null || this.root.hidden) return;
      const p = toLocal(e);
      const idx = hitTestHandle(p.x, p.y, this.fractions, this.display(), this.touchPadPx);
      if (idx === -1) return;
      this.dragIndex = idx;
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.dragIndex === null || this.photo === null) return;
      const p = toLocal(e);
      const f = displayToFractions(p.x, p.y, this.display());
      // Snap a esquina auto-detectada (2026-09-26): vivo durante el drag — el
      // handle salta al target al entrar en radio y escapa al salir. Tras
      // EDITOR_SNAP_MAX_GESTURES gestos, se apaga (el humano manda).
      const snapAllowed =
        this.autoTargets !== null && this.gestures < EDITOR_SNAP_MAX_GESTURES;
      const target = snapAllowed
        ? snapCorner(
            f.x,
            f.y,
            this.autoTargets,
            EDITOR_SNAP_RADIUS_FRACTION,
            this.photo.frameW,
            this.photo.frameH,
          )
        : null;
      this.snapped = target !== null;
      this.fractions[2 * this.dragIndex] = target !== null ? target.x : f.x;
      this.fractions[2 * this.dragIndex + 1] = target !== null ? target.y : f.y;
      this.render();
      this.renderLoupe();
    });
    const end = (): void => {
      if (this.dragIndex === null) return;
      this.gestures++;
      this.dragIndex = null;
      this.snapped = false;
      this.render();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}