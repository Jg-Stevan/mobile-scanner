# Sanity aritmetico — instrumento DPI (Fase 4, T1-R)

Instrumento: `spike.html` (servido via HTTP localhost:8137) — referencia PAPER = Carta 8.5 in.
Formula del spike (linea 457 area video-width / 8.5; label (126) `Carta = 8.5 · A4 = 8.27`;
constante `PAPER_DEFAULT_IN = 8.5` linea 157).

## Caso de referencia (track virtual 1920px, quadSint 0.28..0.72)
- quadX0 = 0.28, quadX1 = 0.72  →  span = 0.44
- anchoQuadPx = 0.44 × 1920 = 844.8 px
- DPI = anchoQuadPx / 8.5 = 844.8 / 8.5 = **99.4 DPI**

Resultado: **~99 DPI** — el instrumento arroja el rango esperado (~99 DPI) para el caso
sintetico de referencia. Verificacion: si el humano coloca una carta VERTICAL llenando el
encuadre en un track 1080p, obtendra ~127-175 DPI (tabla §4 spike-dispositivos = anchoQuadPx/8.5).

## Por que /8.5 y no /8.27
- 844.8 / 8.5  = 99.4   (Carta — es lo que el instrumento reporta)
- 844.8 / 8.27 = 102.1  (A4 — NO es el default; solo etiqueta informativa)

El sanity confirma que la ejecucion usa **carta** (99 ≈ esperado), consistente con
`PAPER_DEFAULT_IN = 8.5`; el literal 8.27 solo sobrevive como etiqueta (`Carta = 8.5 · A4 =
8.27`) y en el comentario de la constante, segun T1-R Fase 2 punto 2.
