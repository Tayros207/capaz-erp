import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { comprasOrdenLineas, comprasRecepcionLineas, comprasRecepciones } from '../../../db/esquema/compras.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { LineaRecibida } from '../domain/recepcion.js';

// Recepciones de una orden: solo se insertan (la base rechaza editarlas o borrarlas). Cada una suma lo
// recibido a sus líneas de la orden en la misma transacción; quien llama ya tiene la orden bloqueada.

export type LineaDeRecepcionGuardada = { ordenLineaId: string; cantidadMilesimas: number };
export type Recepcion = typeof comprasRecepciones.$inferSelect & { lineas: LineaDeRecepcionGuardada[] };

/** Las recepciones de la orden, de la primera a la última, con sus líneas. */
export async function recepcionesDe(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string): Promise<Recepcion[]> {
  const cabeceras = await tx
    .select()
    .from(comprasRecepciones)
    .where(and(eq(comprasRecepciones.tenantId, ctx.empresaId), eq(comprasRecepciones.ordenId, ordenId)))
    .orderBy(asc(comprasRecepciones.numero));
  if (cabeceras.length === 0) return [];
  const lineas = await tx
    .select({ recepcionId: comprasRecepcionLineas.recepcionId, ordenLineaId: comprasRecepcionLineas.ordenLineaId, cantidadMilesimas: comprasRecepcionLineas.cantidadMilesimas })
    .from(comprasRecepcionLineas)
    .where(and(eq(comprasRecepcionLineas.tenantId, ctx.empresaId), inArray(comprasRecepcionLineas.recepcionId, cabeceras.map((c) => c.id))))
    .orderBy(asc(comprasRecepcionLineas.id));
  return cabeceras.map((c) => ({
    ...c,
    lineas: lineas.filter((l) => l.recepcionId === c.id).map(({ ordenLineaId, cantidadMilesimas }) => ({ ordenLineaId, cantidadMilesimas })),
  }));
}

export async function contarRecepciones(tx: Transaccion, ctx: ContextoDeEmpresa, ordenId: string): Promise<number> {
  const [fila] = await tx
    .select({ n: count() })
    .from(comprasRecepciones)
    .where(and(eq(comprasRecepciones.tenantId, ctx.empresaId), eq(comprasRecepciones.ordenId, ordenId)));
  return fila?.n ?? 0;
}

/**
 * Inserta la recepción con el número siguiente dentro de la orden, sus líneas, y suma cada cantidad a
 * `recibido_milesimas` de su línea. Solo con la orden bloqueada (el número y lo recibido se leen y se
 * escriben sin que otra recepción se cruce). El `CHECK recibido <= cantidad` de la base es la última defensa.
 */
export async function registrarRecepcion(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  ordenId: string,
  datos: { fecha: string; nota: string | null },
  lineas: readonly LineaRecibida[],
): Promise<{ id: string; numero: number }> {
  const [ultimo] = await tx
    .select({ n: sql<number>`coalesce(max(${comprasRecepciones.numero}), 0)::int` })
    .from(comprasRecepciones)
    .where(and(eq(comprasRecepciones.tenantId, ctx.empresaId), eq(comprasRecepciones.ordenId, ordenId)));
  const numero = (ultimo?.n ?? 0) + 1;
  const [recepcion] = await tx
    .insert(comprasRecepciones)
    .values({ tenantId: ctx.empresaId, ordenId, numero, fecha: datos.fecha, nota: datos.nota, creadoPor: ctx.usuarioId })
    .returning({ id: comprasRecepciones.id });
  const id = recepcion!.id;
  await tx.insert(comprasRecepcionLineas).values(lineas.map((l) => ({ tenantId: ctx.empresaId, recepcionId: id, ordenLineaId: l.ordenLineaId, cantidadMilesimas: l.cantidadMilesimas })));
  for (const l of lineas) {
    const r = await tx
      .update(comprasOrdenLineas)
      .set({ recibidoMilesimas: sql`${comprasOrdenLineas.recibidoMilesimas} + ${l.cantidadMilesimas}` })
      .where(and(eq(comprasOrdenLineas.tenantId, ctx.empresaId), eq(comprasOrdenLineas.ordenId, ordenId), eq(comprasOrdenLineas.id, l.ordenLineaId)))
      .returning({ id: comprasOrdenLineas.id });
    if (r.length !== 1) throw new Error('La línea recibida no es de esta orden.');
  }
  return { id, numero };
}
