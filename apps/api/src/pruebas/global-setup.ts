import { migrar } from '../../scripts/migrar.ts';
import { esLocal } from './base-de-pruebas.js';

// Antes de las pruebas de integración: migra la base local `capaz_test` con `capaz_owner`.
export default async function preparar(): Promise<void> {
  try {
    process.loadEnvFile(new URL('../../../../.env', import.meta.url));
  } catch {
    // sin .env
  }
  const owner = process.env.DATABASE_URL_OWNER;
  if (!owner || !esLocal(owner)) {
    throw new Error('Las pruebas de integración exigen DATABASE_URL_OWNER apuntando a localhost (nunca a Neon).');
  }
  await migrar({ base: 'capaz_test' });
}
