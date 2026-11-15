import { sql } from 'drizzle-orm';
import { transaccionEnCurso, type Transaccion } from '../../infra/database/con-empresa.js';

export class CorrelativoSinTransaccion extends Error {
  constructor() {
    super('siguienteNumero exige la transacción de conEmpresa.');
    this.name = 'CorrelativoSinTransaccion';
  }
}

/**
 * Siguiente número de una clave (por empresa, serie y año). Un solo `insert … on conflict do update`:
 * la fila queda bloqueada hasta confirmar, así que dos llamadas simultáneas se turnan y, si la
 * transacción se revierte, el número se devuelve (sin huecos).
 */
export async function siguienteNumero(
  tx: Transaccion,
  clave: string,
  opciones: { serie?: string; anio: number },
): Promise<number> {
  if (transaccionEnCurso() !== tx) throw new CorrelativoSinTransaccion();
  if (!clave) throw new Error('siguienteNumero exige una clave.');
  if (!Number.isInteger(opciones.anio)) throw new Error('siguienteNumero exige un año entero.');
  const r = await tx.execute<{ ultimo: string | number }>(
    sql`insert into core.contadores (tenant_id, clave, serie, anio, ultimo)
        values (current_setting('app.tenant_id', true), ${clave}, ${opciones.serie ?? ''}, ${opciones.anio}, 1)
        on conflict (tenant_id, clave, serie, anio) do update set ultimo = core.contadores.ultimo + 1
        returning ultimo`,
  );
  return Number(r.rows[0]!.ultimo);
}
