import { defineConfig } from 'vitest/config';

// Pruebas de integración (`*.int.spec.ts`) contra la base LOCAL `capaz_test`, con los roles reales.
// `global-setup` migra la base y se niega a correr contra un host que no sea localhost.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.int.spec.ts'],
    globalSetup: ['./src/pruebas/global-setup.ts'],
    passWithNoTests: true,
    fileParallelism: false,
    testTimeout: 20000,
  },
});
