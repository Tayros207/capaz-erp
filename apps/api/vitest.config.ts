import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    // Las pruebas de integración (contra PostgreSQL real) tienen su propia configuración.
    exclude: ['**/*.int.spec.ts', '**/node_modules/**', '**/dist/**'],
  },
});
