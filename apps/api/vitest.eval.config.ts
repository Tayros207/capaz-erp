import { defineConfig } from 'vitest/config';

// Banco de evaluación del asistente (`*.eval.ts`). LLAMA A MODELOS DE VERDAD: cuesta dinero y manda datos de ejemplo a un
// tercero. No entra en `pnpm test` ni en `pnpm check`; se corre a mano y solo con orden del dueño (regla 14):
//   pnpm --filter api exec vitest run -c vitest.eval.config.ts
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: { globals: true, root: './', include: ['src/**/*.eval.ts'], globalSetup: ['./src/pruebas/global-setup.ts'], fileParallelism: false, testTimeout: 900_000, disableConsoleIntercept: true },
});
