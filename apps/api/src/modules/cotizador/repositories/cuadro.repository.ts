import { and, eq, sql } from 'drizzle-orm';
import { cotizadorVersiones } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { crearVersion, type DatosDeVersion } from './versiones.repository.js';

// Lo que el cuadro por partes guarda en la versión: `modo = 'cuadro'`, la `entrada` (el cuadro del motor) y, al emitir, el
// `resultado` (la foto). El repositorio no conoce el motor: recibe y devuelve JSON; el dominio lo valida y lo interpreta.

const v = cotizadorVersiones;
const deEmpresa = (ctx: ContextoDeEmpresa) => eq(v.tenantId, ctx.empresaId);

/** Lo que cada edición del borrador deja calculado en la versión (todo en céntimos). */
export type CambiosDeCuadro = Pick<DatosDeVersion, 'igvPorcentaje' | 'conOpciones' | 'subtotalCentimos' | 'igvCentimos' | 'totalCentimos' | 'costoCentimos' | 'margenPct'> & { entrada: object };

/** La versión nueva de una cotización por partes: la fila con su modo y su cuadro. */
export async function crearVersionDeCuadro(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string, version: number, d: DatosDeVersion, entrada: object): Promise<string> {
  const id = await crearVersion(tx, ctx, cotizacionId, version, d);
  await tx.update(v).set({ modo: 'cuadro', entrada }).where(and(deEmpresa(ctx), eq(v.id, id)));
  return id;
}

/** Guarda el cuadro y lo calculado en un borrador. Una versión emitida es inmutable también en la base (disparadores de la 0024). */
export async function guardarCuadro(tx: Transaccion, ctx: ContextoDeEmpresa, versionId: string, c: CambiosDeCuadro): Promise<void> {
  const r = await tx.update(v).set(c).where(and(deEmpresa(ctx), eq(v.id, versionId))).returning({ id: v.id });
  if (r.length !== 1) throw new Error('No se pudo guardar el cuadro.');
}

/** Copia el modo y el cuadro de una versión a otra (nueva versión y duplicar); la foto (`resultado`) no se copia. */
export async function copiarCuadro(tx: Transaccion, ctx: ContextoDeEmpresa, deVersionId: string, aVersionId: string): Promise<void> {
  const [origen] = await tx.select({ modo: v.modo, entrada: v.entrada }).from(v).where(and(deEmpresa(ctx), eq(v.id, deVersionId)));
  if (!origen) throw new Error('No existe la versión de origen.');
  await tx.update(v).set({ modo: origen.modo, entrada: origen.entrada, resultado: null }).where(and(deEmpresa(ctx), eq(v.id, aVersionId)));
}

/** Emitir un cuadro: un solo `update` que pone `emitida_en` y, con él, el cuadro tal como se emitió y su foto. */
export async function marcarCuadroEmitido(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  versionId: string,
  c: CambiosDeCuadro & { condiciones: object; motivoMargenBajo: string | null; resultado: object },
): Promise<void> {
  const r = await tx
    .update(v)
    .set({ ...c, emitidaEn: sql`now()`, emitidaPor: ctx.usuarioId })
    .where(and(deEmpresa(ctx), eq(v.id, versionId)))
    .returning({ id: v.id });
  if (r.length !== 1) throw new Error('No se pudo emitir la versión.');
}
