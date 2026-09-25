# Matriz de dispositivos + checklist de regresión semanal (F6.4)

> PLAN §F6: *"Matriz de dispositivos: documentada desde F0 + checklist de
> regresión semanal (rotación, background, permisos revocados)"*.
> DoD F6: instalable ✓ · 2º arranque <2s · sobrevive rotación/background en
> la matriz documentada.

Este documento es la referencia viva de en qué se prueba y QUÉ se prueba en
cada ronda. Cada ronda validada se registra al final (log con fecha). El
mantenimiento es responsabilidad del humano (validación en dispositivo físico,
AGENTS.md); la IA mantiene el documento y automatiza lo que E2E puede cubrir.

---

## 1. Matriz de dispositivos

| # | Dispositivo | OS / navegador | Rol | Particularidades conocidas |
|---|-------------|----------------|-----|----------------------------|
| 1 | **Samsung SM-A566E** (Galaxy A56) | Android · Chrome | primario Android | AF real expuesto (regla D3); labels traseras correctas; **no pasar `aspectRatio`** en getUserMedia (disciplina T4.3); torch disponible |
| 2 | **iPhone 17 Pro** | iOS · Safari | primario iOS | **D5**: todos los grupos de cámara exponen el mismo track; **D6**: `focusMode` no expuesto → heurística por label (sin ultra-wide/tele); sin AF real → fallback fixed-focus documentado; PWA instalable por A2HS |
| 3 | **Playwright Chromium** (fakecam) | Linux headless | E2E automatizado | `--use-fake-device-for-media-stream` + `--use-fake-ui-for-media-stream`; cubre boot, PWA offline, telemetría y robustez (suite `scripts/test-*.mjs`); NO sustituye validación en dispositivo |

### Hallazgos por dispositivo (resumen histórico)

- **Ambos (red datacenter)**: `docs.opencv.org` responde 403 Cloudflare a
  datacenters → SPOF detectado en F4-fix-arranque, resuelto en F6.1 con
  self-host (`vendor/opencv-4.5.5.js`). Verificar siempre el marcador
  `#mOpencv=vendor/opencv-4.5.5.js`.
- **Android**: la cascada de apertura funciona a nivel 1 (presupuesto 3840px).
- **iOS**: la cascada suele caer a niveles 1→2 igualmente; el perfil D6 avisa
  por warnings ("sin autofocus real").
- **iOS PWA**: el 2º arranque offline requiere haber completado una 1ª sesión
  con red (el precache del SW se llena al servir los assets).

---

## 2. Checklist de regresión semanal

Ejecutar **en los dispositivos 1 y 2** (ambos). Marcar ✔/✘ y anotar fecha.
Si un ítem falla: captura + pasos reproducidos + pegar resultado al
orquestador (texto plano o rama `evidencias/`).

| # | Ítem | Pasos | Esperado |
|---|------|-------|----------|
| W1 | opencv LOCAL | abrir harness (f4 y f5) → mirar `#mOpencv` | `vendor/opencv-4.5.5.js` (nunca CDN) |
| W2 | **Rotación en vivo** | iniciar cámara → girar teléfono portrait↔landscape sin tocar nada | overlay se re-encadra sin recargar; `#mCam` se re-perfila; sin error |
| W3 | **Background corto** | iniciar → app a segundo plano ~30 s → volver | sigue detectando; SIN toast "no se detectó" falso (F6.4 re-arma el plazo) |
| W4 | **Permisos revocados en vivo** | con cámara activa, revocar permiso desde ajustes del navegador | banner rojo recuperable "Cámara perdida…"; al permitir de nuevo, Iniciar recupera la cámara conservando la galería |
| W5 | Cámara ocupada (si aplica) | iniciar una videollamada en otra app → abrir el scanner | banner "Cámara ocupada" con pista clara (clasificación F6.4) |
| W6 | 2º arranque PWA < 2 s | app instalada → cerrar del todo → abrir | arranca y muestra cámara sin red en <2 s aprox |
| W7 | PWA offline real | app instalada → modo avión → abrir | boot completo desde caché (shell + worker + opencv) |
| W8 | F5 funcional | 3 páginas → exportar PDF | PDF < 3 MB, orden correcto |
| W9 | 4 modos imagen | original/gris/BN/texto en la galería | sin banding en BN/texto |
| W10 | CER | exportar CER JSON con OCR | genera tabla y descarga JSON |
| W11 | Telemetría OFF por defecto | abrir sin tocar el panel de telemetría | "local N — nada sale"; cero peticiones externas |

### Casos borde cubiertos por automatización (no requieren dispositivo)

- Registro SW aislado de las E2E con stubs (`?sw=1` bajo webdriver; `?sw-off`).
- Arranque con permiso denegado desde el primer instante (banner + pista).
- Rotación por resize (E2E: viewport portrait→landscape sin errores).
- Pérdida de track (`ended`) con recuperación por botón.
- Re-arme del plazo de 8 s tras background (`extendDeadline`, unit).

---

## 3. Log de rondas

| Fecha | Dispositivos | Checklist | Observaciones |
|-------|--------------|-----------|---------------|
| (pendiente primera ronda F6.4) | | | |
