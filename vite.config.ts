// vite.config.ts — configuración de Vite (T2 scaffolding, §8).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199 },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/core/geometry.ts'],
      thresholds: { lines: 90 },
    },
  },
});
