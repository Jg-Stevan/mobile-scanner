# T1-R3 Deploy Evidence

## URL pública
https://jg-stevan.github.io/mobile-scanner/spike.html

## Verificación Playwright (deploy público)

### ✅ HTTPS + contenido
- Status 200
- Título: "Spike F0 — Digitalizador (diagnóstico de dispositivos)"
- Panel DPI: value="8.5", label "(Carta = 8.5 · A4 = 8.27)", instructivo "tamaño carta, VERTICAL... ancho visible = 8.5 in"
- Rangos DPI carta: ~353–364 / ~127–175 / ~254–349 / ~356+

### ✅ Cámara fake activa
- VGA WebCam 640×480 @30fps
- getSettings() y getCapabilities() funcionando
- 141k+ frames contados

### ✅ Fix T1-R2 confirmado en producción
- Canvas DPI: 1293×1724
- **6122 píxeles verdes (#2da44e)** → quad dibujado, NO colapsado
- Quad variable fracciones correctas: 4 esquinas distribuidas (0.28-0.72, 0.22-0.78)
- Video nativo: 640×480

### 📸 Screenshot
PLAN_EVIDENCE/T1-R3/spike-deploy-quad.png

### Commits
- cfa60e1: T1-carta + T1-R2 (migración A4→Carta + fix coords/leak/torch)

---
Fecha: 2026-09-21
