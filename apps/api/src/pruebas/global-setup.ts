import type { TestProject } from 'vitest/node';
import { migrar } from '../../scripts/migrar.ts';
import { abrirPool, baseDePruebas, esLocal } from './base-de-pruebas.js';

// Antes de las pruebas de integración: migra la base local de pruebas (`CAPAZ_TEST_DB`, por defecto `capaz_test`) con `capaz_owner`.
export default async function preparar(proyecto: TestProject): Promise<void> {
  // Un archivo a la vez (ver `vitest.int.config.ts`). Si algo vuelve a subir los trabajadores, que falle aquí y no al azar.
  const trabajadores = proyecto.config.maxWorkers;
  if (trabajadores !== 1) {
    throw new Error(`Las pruebas de integración corren un archivo a la vez y Vitest resolvió ${trabajadores} trabajadores: comparten la base y el relevo es global.`);
  }
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url));
  } catch {
    // sin .env
  }
  const owner = process.env.DATABASE_URL_OWNER;
  if (!owner || !esLocal(owner)) {
    throw new Error('Las pruebas de integración exigen DATABASE_URL_OWNER apuntando a localhost (nunca a Neon).');
  }
  await migrar({ base: baseDePruebas() });
  // El limitador de Better Auth guarda su cuenta en la base (por IP y ruta; aquí siempre 127.0.0.1) y solo la reinicia
  // tras 60 s sin peticiones: varias corridas seguidas la acumulan hasta el tope (1000 altas) y todo responde 429 un minuto.
  const dueno = abrirPool('owner');
  try {
    await dueno.query('delete from auth.rate_limit');
  } finally {
    await dueno.end();
  }
}
