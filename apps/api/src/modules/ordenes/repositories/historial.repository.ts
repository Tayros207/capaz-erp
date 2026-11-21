import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { ORIGEN_DE_HISTORIAL } from '@capaz/shared';
import { clientes, sucursales } from '../../../db/esquema/core-maestros.js';
import { ordenesPedidoLineas, ordenesPedidos } from '../../../db/esquema/ordenes.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';

// Lecturas y escritura en bloque del importador del historial. La RLS aísla por empresa; el `where` por empresa es defensa en profundidad.

/** Nombre de la sucursal (archivada o no) que usa el código dado, o `null`. */
export async function sucursalConCodigo(tx: Transaccion, ctx: ContextoDeEmpresa, codigo: string): Promise<string | null> {
  const [fila] = await tx.select({ nombre: sucursales.nombre }).from(sucursales).where(and(eq(sucursales.tenantId, ctx.empresaId), eq(sucursales.codigo, codigo))).limit(1);
  return fila?.nombre ?? null;
}

/** Clientes por nombre normalizado (los fusionados no cuentan; los archivados sí). */
export async function clientesPorNombre(tx: Transaccion, ctx: ContextoDeEmpresa, normalizados: readonly string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (let i = 0; i < normalizados.length; i += 500) {
    const filas = await tx
      .select({ id: clientes.id, clave: clientes.nombreNormalizado })
      .from(clientes)
      .where(and(eq(clientes.tenantId, ctx.empresaId), inArray(clientes.nombreNormalizado, normalizados.slice(i, i + 500)), sql`${clientes.fusionadoEn} is null`))
      .orderBy(asc(clientes.creadoEn));
    for (const f of filas) if (!mapa.has(f.clave)) mapa.set(f.clave, f.id);
  }
  return mapa;
}

/** Cuáles de estas huellas ya están en un pedido importado, aunque después se haya cancelado (un trabajo cancelado cuenta como repetido). */
export async function huellasExistentes(tx: Transaccion, ctx: ContextoDeEmpresa, huellas: readonly string[]): Promise<Set<string>> {
  const vistas = new Set<string>();
  for (let i = 0; i < huellas.length; i += 500) {
    const filas = await tx
      .select({ huella: ordenesPedidos.origenId })
      .from(ordenesPedidos)
      .where(and(eq(ordenesPedidos.tenantId, ctx.empresaId), eq(ordenesPedidos.origenTipo, ORIGEN_DE_HISTORIAL), inArray(ordenesPedidos.origenId, huellas.slice(i, i + 500))));
    for (const f of filas) if (f.huella) vistas.add(f.huella);
  }
  return vistas;
}

export type PedidoDeHistorial = typeof ordenesPedidos.$inferInsert & { origenId: string };
export type LineaDeHistorial = { huella: string; descripcion: string; totalCentimos: number };

/**
 * Inserta los pedidos y sus líneas (una línea cada uno) en dos sentencias por tanda de 1,000. Devuelve cuántos pedidos entraron:
 * si es menos que los pedidos, algo chocó (huella o número repetidos) y quien llama debe revertir.
 */
export async function insertarHistorial(tx: Transaccion, ctx: ContextoDeEmpresa, pedidos: readonly PedidoDeHistorial[], lineas: readonly LineaDeHistorial[]): Promise<number> {
  const descripcionDe = new Map(lineas.map((l) => [l.huella, l]));
  let entraron = 0;
  for (let i = 0; i < pedidos.length; i += 1000) {
    const tanda = pedidos.slice(i, i + 1000);
    const filas = await tx.insert(ordenesPedidos).values(tanda).onConflictDoNothing().returning({ id: ordenesPedidos.id, huella: ordenesPedidos.origenId });
    entraron += filas.length;
    if (filas.length !== tanda.length) return entraron;
    await tx.insert(ordenesPedidoLineas).values(
      filas.map((f) => {
        const l = descripcionDe.get(f.huella!)!;
        return { tenantId: ctx.empresaId, pedidoId: f.id, posicion: 0, productoId: null, descripcion: l.descripcion, unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: l.totalCentimos * 10, afectoIgv: false, importeCentimos: l.totalCentimos };
      }),
    );
  }
  return entraron;
}
