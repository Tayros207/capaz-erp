import { defineConfig } from 'vitest/config';

// Pruebas de integración (`*.int.spec.ts`) contra la base LOCAL `capaz_test`, con los roles reales.
// `global-setup` migra la base y se niega a correr contra un host que no sea localhost.

// UN ARCHIVO A LA VEZ, siempre: todos comparten una base y el relevo es global (`procesarLote` reserva eventos de
// cualquier empresa). Con dos archivos a la vez, el relevo de uno se lleva los eventos del otro y este no encuentra sus
// borradores. Vitest 4 aplica `VITEST_MAX_WORKERS` DESPUÉS de `fileParallelism: false` y lo pisa: `VITEST_MAX_WORKERS=2
// pnpm check` corría dos archivos a la vez. Aquí esa variable no rige (sí en las unitarias); `global-setup` lo comprueba.
delete process.env.VITEST_MAX_WORKERS;

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
