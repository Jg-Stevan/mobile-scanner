# Pruebas humanas F5 — material para revisión externa

**Fecha de captura**: 2026-09-25 (20:27–21:57 UTC, según timestamps de los archivos)
**Origen**: validación humana en dispositivo (flujo real de la app: escaneo multipágina → modos de imagen → PDF → medición CER)
**Estado**: ⏳ PENDIENTE DE VEREDICTO — este material se sube para que el revisor externo lo analice. F5 NO se marca validada hasta ese veredicto.

## Artefactos

| Archivo | Qué es |
|---|---|
| `scanner-1790368025567.pdf` (5.3MB) | PDF exportado por la app (primera captura, 20:27 UTC) |
| `scanner-1790370839340.pdf` (4.2MB) | PDF exportado por la app (segunda captura, 21:13 UTC) — inmediatamente antes de la medición CER |
| `f5-cer-1790370855233.json` | Salida cruda del harness de CER: texto de referencia, texto hipótesis por modo y métricas |

### Lote 2 (21:49–21:57 UTC)

| Archivo | Qué es |
|---|---|
| `scanner-1790373027082.pdf` (0.13MB) | PDF exportado por la app (tercera captura, 21:51 UTC) |
| `scanner-1790373351073.pdf` (2.3MB) | PDF exportado por la app (cuarta captura, 21:57 UTC) — inmediatamente antes de la segunda medición CER del lote |
| `f5-cer-1790373022167.json` | Salida cruda del harness de CER, primera medición del lote (ts interno `1790372969911`, 21:49:29 UTC) |
| `f5-cer-1790373346649.json` | Salida cruda del harness de CER, segunda medición del lote (ts interno `1790373334017`, 21:55:34 UTC) |

## Resumen del CER medido (del JSON, sin interpretación)

| Modo | CER | Caracteres referencia | Caracteres hipótesis |
|---|---|---|---|
| color | 0.6895 | 4966 | 5545 |
| gray | 0.6190 | 4966 | 4474 |
| bw | 0.6442 | 4966 | 2931 |
| natural | 0.6200 | 4966 | 4540 |

Timestamp interno del JSON: `1790370816925` (21:13:36 UTC).

### Lote 2 — `f5-cer-1790373022167.json` (referencia: 634 caracteres)

| Modo | CER | Caracteres referencia | Caracteres hipótesis |
|---|---|---|---|
| color | 0.2461 | 634 | 661 |
| gray | 0.6483 | 634 | 847 |
| bw | 0.2997 | 634 | 738 |
| natural | 0.1751 | 634 | 668 |

Timestamp interno del JSON: `1790372969911` (21:49:29 UTC).

### Lote 2 — `f5-cer-1790373346649.json` (referencia: 703 caracteres)

| Modo | CER | Caracteres referencia | Caracteres hipótesis |
|---|---|---|---|
| color | 0.4708 | 703 | 740 |
| gray | 0.4154 | 703 | 679 |
| bw | 0.4097 | 703 | 689 |
| natural | 0.3940 | 703 | 619 |

Timestamp interno del JSON: `1790373334017` (21:55:34 UTC).

## Notas para el revisor

- El JSON contiene los textos completos (`reference`, `rows[].text`) para recalcular/verificar el CER de forma independiente.
- Llamada de atención: el propio texto de referencia almacenado en el JSON luce degradado/ruidoso (parece salir de un OCR previo y no de texto digital limpio). El revisor debe determinar si la referencia es válida antes de sacar conclusiones de los valores absolutos de CER; la comparación RELATIVA entre modos (misma referencia para los 4) es más robusta que el valor absoluto.
- Los 4 PDFs (2 del lote 1 + 2 del lote 2) permiten la revisión visual pendiente (banding CLAHE en los modos gray/bw/natural, D-F5-b).
- Pendiente humano adicional de F5: revisión visual de banding sobre estos PDFs.
