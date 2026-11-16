import { ORIGENES_DE_BORRADOR, type NombreDeHerramienta } from '@capaz/shared';
import { sql } from 'drizzle-orm';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { emitir } from '../eventos/emisor.js';
import { datosDeHerramienta } from './catalogo.js';

export type PropuestaDeBorrador = {
  herramienta: NombreDeHerramienta;
  args: unknown;
  resumen: string;
  origen: (typeof ORIGENES_DE_BORRADOR)[number];
  origenRef?: string;
  prioridad?: 'normal' | 'alta';
  propuestoPor: string;
  capturaIniciadaEn?: Date;
};

export class HerramientaDeBorradorDesconocida extends Error {
  constructor(nombre: string) {
    super(`No se puede proponer un borrador: la herramienta «${nombre}» no existe.`);
    this.name = 'HerramientaDeBorradorDesconocida';
  }
}

export class HerramientaConSecretos extends Error {
  constructor(nombre: string) {
    super(`«${nombre}» maneja credenciales o secretos: no se puede proponer como borrador.`);
    this.name = 'HerramientaConSecretos';
  }
}

/** Herramientas cuyos argumentos o resultado llevan credenciales: un borrador las guardaría en claro. */
export const HERRAMIENTAS_CON_SECRETOS: readonly string[] = [
  'conexion_configurar',
  'clave_api_crear',
  'webhooks_salientes_crear',
  'webhooks_salientes_editar',
];

/**
 * Guarda una llamada a herramienta pendiente de aprobación. Solo comprueba que la herramienta existe:
 * los argumentos se validan al aprobar (un dictado puede venir incompleto). La empresa sale de la
 * sesión de la transacción (regla 4). Emite `borrador.propuesto` en la misma transacción.
 */
export async function proponerBorrador(tx: Transaccion, b: PropuestaDeBorrador): Promise<{ id: string }> {
  const h = datosDeHerramienta(b.herramienta);
  if (!h) throw new HerramientaDeBorradorDesconocida(b.herramienta);
  if (HERRAMIENTAS_CON_SECRETOS.includes(b.herramienta)) throw new HerramientaConSecretos(b.herramienta);
  const [fila] = await tx
    .insert(borradores)
    .values({
      // `tenant_id` lo fija la sesión de la transacción, igual que en las demás tablas del núcleo.
      tenantId: sql`current_setting('app.tenant_id', true)`,
      herramienta: b.herramienta,
      modulo: h.modulo,
      args: b.args ?? {},
      argsOriginales: b.args ?? {},
      resumen: b.resumen,
      origen: b.origen,
      origenRef: b.origenRef ?? null,
      prioridad: b.prioridad ?? 'normal',
      propuestoPor: b.propuestoPor,
      capturaIniciadaEn: b.capturaIniciadaEn ?? null,
    })
    .returning({ id: borradores.id });
  if (!fila) throw new Error('No se pudo guardar el borrador.');
  await emitir(tx, 'borrador.propuesto', {
    id: fila.id,
    herramienta: b.herramienta,
    modulo: h.modulo,
    origen: b.origen,
    prioridad: b.prioridad ?? 'normal',
  });
  return { id: fila.id };
}
