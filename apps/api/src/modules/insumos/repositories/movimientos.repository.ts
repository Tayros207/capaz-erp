import { and, desc, eq, getTableColumns, inArray, sql, type SQL } from 'drizzle-orm';
import { productos, sucursales } from '../../../db/esquema/core-maestros.js';
import { insumosArticulos, insumosMovimientos } from '../../../db/esquema/insumos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codificarCursorPorInstante, decodificarCursorPorInstante } from '../domain/cursor.js';
import type { TipoDeMovimiento } from '../domain/existencia.js';

// Historial de movimientos: solo se agrega (la tabla es de inserción y rechaza update y delete). Un error se
// corrige con otro movimiento. `alcance: 'propios'` limita a lo que la persona registró (R4).

export type Alcance = 'todos' | 'propios';
export type MovimientoNuevo = {
  articuloId: string;
  sucursalId: string;
  tipo: TipoDeMovimiento;
  cantidadMilesimas: number;
  existenciaResultanteMilesimas: number;
  costoUnitarioMilesimas: number | null;
  motivo: string | null;
  origenTipo: string | null;
  origenId: string | null;
};
export type Movimiento = typeof insumosMovimientos.$inferSelect & { nombre: string; unidad: string; sucursalCodigo: string };

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(insumosMovimientos.tenantId, ctx.empresaId);

/** Inserta el movimiento. `null` si ese origen ya trajo ese artículo (único parcial de la base): no se suma dos veces. */
export async function insertarMovimiento(tx: Transaccion, ctx: ContextoDeEmpresa, m: MovimientoNuevo): Promise<string | null> {
  const [fila] = await tx
    .insert(insumosMovimientos)
    .values({ ...m, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning({ id: insumosMovimientos.id });
  return fila?.id ?? null;
}

/**
 * Turna, dentro de la empresa, a quienes reciben el MISMO origen a la vez (bloqueo de la transacción, se suelta al
 * terminar): el segundo ve lo que dejó el primero y responde «ya recibido» en vez de chocar con el único parcial.
 */
export async function bloquearOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, origenTipo: string, origenId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`insumos:${ctx.empresaId}:${origenTipo}:${origenId}`}, 0))`);
}

function consultaDeMovimientos(tx: Transaccion) {
  return tx
    .select({
      ...getTableColumns(insumosMovimientos),
      nombre: productos.nombre,
      unidad: insumosArticulos.unidad,
      sucursalCodigo: sucursales.codigo,
      instante: sql<string>`${insumosMovimientos.creadoEn}::text`,
    })
    .from(insumosMovimientos)
    .innerJoin(insumosArticulos, and(eq(insumosArticulos.tenantId, insumosMovimientos.tenantId), eq(insumosArticulos.id, insumosMovimientos.articuloId)))
    .innerJoin(productos, and(eq(productos.tenantId, insumosArticulos.tenantId), eq(productos.id, insumosArticulos.productoId)))
    .innerJoin(sucursales, and(eq(sucursales.tenantId, insumosMovimientos.tenantId), eq(sucursales.id, insumosMovimientos.sucursalId)));
}

const sinInstante = ({ instante: _instante, ...m }: Movimiento & { instante: string }): Movimiento => m;

export async function verMovimientos(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Movimiento[]> {
  if (ids.length === 0) return [];
  const filas = await consultaDeMovimientos(tx).where(and(deEmpresa(ctx), inArray(insumosMovimientos.id, [...ids])));
  const porId = new Map(filas.map((f) => [f.id, sinInstante(f)]));
  return ids.flatMap((id) => porId.get(id) ?? []);
}

/** Los movimientos que ya trajo ese origen, en el orden en que se registraron. */
export async function movimientosDeOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, origenTipo: string, origenId: string): Promise<Movimiento[]> {
  const filas = await consultaDeMovimientos(tx)
    .where(and(deEmpresa(ctx), eq(insumosMovimientos.origenTipo, origenTipo), eq(insumosMovimientos.origenId, origenId)))
    .orderBy(insumosMovimientos.creadoEn, insumosMovimientos.id);
  return filas.map(sinInstante);
}

export type FiltrosDeMovimientos = { limite: number; cursor?: string; articuloId?: string; sucursalId?: string; tipo?: TipoDeMovimiento };

const deAlcance = (ctx: ContextoDeEmpresa, alcance: Alcance): SQL | undefined => (alcance === 'propios' ? eq(insumosMovimientos.creadoPor, ctx.usuarioId) : undefined);

/** Del más nuevo al más antiguo, por (instante, id). */
export async function listarMovimientos(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: FiltrosDeMovimientos,
): Promise<{ items: Movimiento[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursorPorInstante(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const filas = await consultaDeMovimientos(tx)
    .where(
      and(
        deEmpresa(ctx),
        deAlcance(ctx, alcance),
        f.articuloId ? eq(insumosMovimientos.articuloId, f.articuloId) : undefined,
        f.sucursalId ? eq(insumosMovimientos.sucursalId, f.sucursalId) : undefined,
        f.tipo ? eq(insumosMovimientos.tipo, f.tipo) : undefined,
        pos ? sql`(${insumosMovimientos.creadoEn}, ${insumosMovimientos.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(insumosMovimientos.creadoEn), desc(insumosMovimientos.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(sinInstante),
    siguiente: filas.length > f.limite && ultima ? codificarCursorPorInstante({ instante: ultima.instante, id: ultima.id }) : null,
  };
}
