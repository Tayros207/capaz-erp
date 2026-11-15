import { sql } from 'drizzle-orm';
import type { FuenteDeTiempo } from './tipos.js';

/** Fuente del núcleo: la prueba de un módulo vence (`core.empresa_modulos.prueba_hasta`). Con `dias` negativos avisa antes. */
export const pruebaDeModuloVence: FuenteDeTiempo = {
  clave: 'core.prueba_de_modulo_vence',
  modulo: 'core',
  descripcion: 'La prueba de un módulo contratado vence.',
  async candidatos(tx) {
    const r = await tx.execute<{ modulo: string; prueba_hasta: string | Date }>(
      sql`select modulo, prueba_hasta from core.empresa_modulos where estado = 'prueba' and prueba_hasta is not null`,
    );
    return r.rows.map((f) => ({
      entidadTipo: 'empresa_modulo',
      entidadId: f.modulo,
      fecha: new Date(f.prueba_hasta),
      datos: { modulo: f.modulo, pruebaHasta: new Date(f.prueba_hasta).toISOString() },
    }));
  },
};
