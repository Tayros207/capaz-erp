import { sql } from 'drizzle-orm';
import { transaccionEnCurso, type Transaccion } from '../../infra/database/con-empresa.js';
import { CorrelativoSinTransaccion } from './siguiente-numero.js';

/**
 * Reserva `cantidad` números seguidos de una clave (por empresa, serie y año) y devuelve el PRIMERO del bloque.
 * Igual que `siguienteNumero`, pero con un solo `insert … on conflict do update`: sirve para importar muchas filas de una vez.
 * Si la transacción se revierte, el bloque se devuelve (sin huecos).
 */
export async function reservarNumeros(
  tx: Transaccion,
  clave: string,
  opciones: { serie?: string; anio: number },
  cantidad: number,
): Promise<number> {
  if (transaccionEnCurso() !== tx) throw new CorrelativoSinTransaccion();
  if (!clave) throw new Error('reservarNumeros exige una clave.');
  if (!Number.isInteger(opciones.anio)) throw new Error('reservarNumeros exige un año entero.');
  if (!Number.isInteger(cantidad) || cantidad < 1) throw new Error('reservarNumeros exige una cantidad entera de 1 o más.');
  const r = await tx.execute<{ ultimo: string | number }>(
    sql`insert into core.contadores (tenant_id, clave, serie, anio, ultimo)
        values (current_setting('app.tenant_id', true), ${clave}, ${opciones.serie ?? ''}, ${opciones.anio}, ${cantidad})
        on conflict (tenant_id, clave, serie, anio) do update set ultimo = core.contadores.ultimo + ${cantidad}
        returning ultimo`,
  );
  return Number(r.rows[0]!.ultimo) - cantidad + 1;
}
