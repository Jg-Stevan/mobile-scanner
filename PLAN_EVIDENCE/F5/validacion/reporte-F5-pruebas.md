# Pruebas humanas F5 — material para revisión externa

**Fecha de captura**: 2026-09-25 (20:27–21:14 UTC, según timestamps de los archivos)
**Origen**: validación humana en dispositivo (flujo real de la app: escaneo multipágina → modos de imagen → PDF → medición CER)
**Estado**: ⏳ PENDIENTE DE VEREDICTO — este material se sube para que el revisor externo lo analice. F5 NO se marca validada hasta ese veredicto.

## Artefactos

| Archivo | Qué es |
|---|---|
| `scanner-1790368025567.pdf` (5.3MB) | PDF exportado por la app (primera captura, 20:27 UTC) |
| `scanner-1790370839340.pdf` (4.2MB) | PDF exportado por la app (segunda captura, 21:13 UTC) — inmediatamente antes de la medición CER |
| `f5-cer-1790370855233.json` | Salida cruda del harness de CER: texto de referencia, texto hipótesis por modo y métricas |

## Resumen del CER medido (del JSON, sin interpretación)

| Modo | CER | Caracteres referencia | Caracteres hipótesis |
|---|---|---|---|
| color | 0.6895 | 4966 | 5545 |
| gray | 0.6190 | 4966 | 4474 |
| bw | 0.6442 | 4966 | 2931 |
| natural | 0.6200 | 4966 | 4540 |

Timestamp interno del JSON: `1790370816925` (21:13:36 UTC).

## Notas para el revisor

- El JSON contiene los textos completos (`reference`, `rows[].text`) para recalcular/verificar el CER de forma independiente.
- Llamada de atención: el propio texto de referencia almacenado en el JSON luce degradado/ruidoso (parece salir de un OCR previo y no de texto digital limpio). El revisor debe determinar si la referencia es válida antes de sacar conclusiones de los valores absolutos de CER; la comparación RELATIVA entre modos (misma referencia para los 4) es más robusta que el valor absoluto.
- Los 2 PDFs permiten la revisión visual pendiente (banding CLAHE en los modos gray/bw/natural, D-F5-b).
- Pendiente humano adicional de F5: revisión visual de banding sobre estos PDFs.
