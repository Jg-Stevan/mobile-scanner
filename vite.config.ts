// vite.config.ts — configuración de Vite (T2 scaffolding, §8).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199 },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: [
        'src/core/geometry.ts',
        'src/core/quality.ts',
        'src/core/quadSelect.ts',
        'src/workers/withMats.ts',
        'src/workers/pipeline.ts',
        'src/workers/protocol.ts',
        'src/camera/frameLoop.ts',
        'src/camera/CameraController.ts',
        'src/camera/hiResCapture.ts',
        'src/ui/ScannerView.ts',
        'src/ui/ScoreView.ts',
        'src/scan/ScanOrchestrator.ts',
        'src/scan/scoring.ts',
      ],
      thresholds: { lines: 90 },
    },
  },
});
