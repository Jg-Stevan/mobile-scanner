# Evidencia T5 — CameraController + hiResCapture (rutas A/B/C) + CameraProfile

Fecha: 2026-09-21 · Precondición: T4 en baseline (`7b2ffd3`).
Skill aplicada: `ios-camera-quirks` (torch degradación, from-image, D3).

## Implementación (primitivas, sin score/shutter/re-detección)
- `src/camera/CameraController.ts` — enumerate → probe por cámara (abre/cierra
  track temporal) → `chooseMainCamera` (regla D3: AF continuous/single-shot,
  desempate por resolución; fallback fixed-focus + warning) → gUM en cascada
  (exact+3840 ideal SIN ratio → exact → genérico). Profile desde getSettings/
  getCapabilities (reutiliza `CameraProfile` de core, sin tocarlo). Torch con
  degradación silenciosa. `refreshProfile()` + `watchOrientation()` (D2).
- `src/camera/hiResCapture.ts` — ruta A takePhoto→blob→bitmap; ruta B drawImage
  a canvas nativo→JPEG q92→bitmap; ruta C files→bitmaps. Todas con
  `imageOrientation:'from-image'` + fallback sin opción. Deps inyectables.
- Notas F1 del review externo registradas en WORKFLOW_STATE → Backlog F1.

## Verificación automatizada (todo lo automatizable, verde)
- Unit: 89/89 (24 nuevos T5: D3 con back-AF vs ultra-wide-manual-mayor,
  fallbacks gUM en cascada, probe fallido, torch on/off/unsupported, refresh,
  watch/unwatch, rutas A/B/C, fallback sin from-image, defaults document).
  tsc limpio. Coverage: Controller 98.9%, hiRes 95.2% líneas.
- Playwright fake cam 640×480 (harness temporal en raíz, borrado tras el E2E;
  `harness-t5-done.png` + `profile-t5.json`):
  profile poblado (VGA, 640×480, torch false, focusModes []) + warnings de
  fallback fixed-focus (rama realista ejercitada E2E) · ruta B 640×480 ==
  settings ✓ · EXIF orientation 6: from-image → 50×100 ✓, ruta C → 50×100 ✓ ·
  torch → unsupported ✓.
- Matiz documentado: en Chromium el control SIN opción también dio 50×100
  (su default ya es from-image); la opción explícita es para Safari — por eso
  el fallback sin opción sigue siendo correcto.

## Adjudicación /ship (revisor APROBADO vs revisor-b 1 finding → juzga orquestador)
- Finding (IDEAL_CAPTURE_WIDTH=3840 vs cap 3500px): DESESTIMADO.
  1. El cap rige la SALIDA del warp (F3, 3500/11in ≈ 318 DPI) y prohíbe operar
     12MP en hilo principal (AGENTS.md) — no la negociación de entrada: `ideal`
     es pista, no garantía; el navegador resuelve (SM-A566E da 2160×3840 igual).
  2. El spec T5 aprobado por el humano EXIGE "width ideal 3840"; bajarlo a 3500
     degradaría la captura sin beneficio y contradiría el spec.
  3. El propio revisor-b deja la puerta abierta a esta lectura ("puede
     reconsiderarse"). El worker recibe 480p y el warp se capa en F3: el cap
     se cumple donde aplica.
- Veredicto final: APROBADO.

## ⏳ PENDIENTE HUMANO (no bloquea el código; división agente/humano AGENTS.md)
- Android real SM-A566E: app de prueba → DEBE elegir camera 0 (no ultra-wide)
  por D3; profile ≈ (2160×3840, torch true, 3 focusModes); ruta A takePhoto OK.
  Screenshot del log → completar esta evidencia.

## Prohibiciones respetadas
- Sin score/shutter/re-detección. Sin duplicar frameLoop (reutilizado tal cual).
  Sin tocar core/, spike.html, tests/bench/. facingMode no usado como selector.
