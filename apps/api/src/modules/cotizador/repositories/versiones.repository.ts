import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { cotizadorEventos, cotizadorVersionLineas, cotizadorVersiones } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { LineaArmada } from '../domain/lineas.js';

// Repositorio de versiones, sus líneas y el historial de una cotización. Una versión emitida es inmutable
// también en la base (disparadores de la 0024): aquí solo se escribe en versiones sin emitir.

const v = cotizadorVersiones;
const l = cotizadorVersionLineas;
const e = cotizadorEventos;
export type Version = typeof v.$inferSelect;
export type LineaDeVersion = typeof l.$inferSelect;
export type EventoDeCotizacion = typeof e.$inferSelect;
export type TipoDeEventoDeCotizacion = EventoDeCotizacion['tipo'];

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(v.tenantId, ctx.empresaId);

export type DatosDeVersion = {
  igvPorcentaje: number;
  conOpciones: boolean;
  subtotalCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  costoCentimos: number | null;
  margenPct: string | null;
  motivoMargenBajo: string | null;
  condiciones: object;
  observaciones: string | null;
};
/** Lo que se copia de una versión a la siguiente (nueva versión y duplicar): todo menos la emisión y el motivo de margen. */
export const datosParaCopiar = (x: Version): DatosDeVersion => ({
  igvPorcentaje: x.igvPorcentaje,
  conOpciones: x.conOpciones,
  subtotalCentimos: x.subtotalCentimos,
  igvCentimos: x.igvCentimos,
  totalCentimos: x.totalCentimos,
  costoCentimos: x.costoCentimos,
  margenPct: x.margenPct,
  motivoMargenBajo: null,
  condiciones: x.condiciones as object,
  observaciones: x.observaciones,
});
export type CambiosDeVersion = Partial<DatosDeVersion>;

export async function crearVersion(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string, version: number, d: DatosDeVersion): Promise<string> {
  const [fila] = await tx.insert(v).values({ ...d, tenantId: ctx.empresaId, cotizacionId, version, creadoPor: ctx.usuarioId }).returning({ id: v.id });
  if (!fila) throw new Error('No se pudo crear la versión.');
  return fila.id;
}

export async function versionDe(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string, version: number): Promise<Version | null> {
  const [fila] = await tx.select().from(v).where(and(deEmpresa(ctx), eq(v.cotizacionId, cotizacionId), eq(v.version, version)));
  return fila ?? null;
}

export async function versionesDe(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string): Promise<Version[]> {
  return tx.select().from(v).where(and(deEmpresa(ctx), eq(v.cotizacionId, cotizacionId))).orderBy(desc(v.version));
}

export async function actualizarVersion(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeVersion): Promise<void> {
  const r = await tx.update(v).set(cambios).where(and(deEmpresa(ctx), eq(v.id, id))).returning({ id: v.id });
  if (r.length !== 1) throw new Error('No se pudo actualizar la versión.');
}

/** Emitir: el `update` que pone `emitida_en` mientras `old.emitida_en` es nulo (el disparador lo deja pasar; después, nada). */
export async function marcarVersionEmitida(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: { condiciones: object; motivoMargenBajo: string | null }): Promise<void> {
  const r = await tx
    .update(v)
    .set({ ...cambios, emitidaEn: sql`now()`, emitidaPor: ctx.usuarioId })
    .where(and(deEmpresa(ctx), eq(v.id, id)))
    .returning({ id: v.id });
  if (r.length !== 1) throw new Error('No se pudo emitir la versión.');
}

export async function lineasDe(tx: Transaccion, ctx: ContextoDeEmpresa, versionId: string): Promise<LineaDeVersion[]> {
  return tx.select().from(l).where(and(eq(l.tenantId, ctx.empresaId), eq(l.versionId, versionId))).orderBy(asc(l.posicion));
}

/** Reemplaza todas las líneas de una versión sin emitir. */
export async function reemplazarLineas(tx: Transaccion, ctx: ContextoDeEmpresa, versionId: string, lineas: readonly LineaArmada[]): Promise<void> {
  await tx.delete(l).where(and(eq(l.tenantId, ctx.empresaId), eq(l.versionId, versionId)));
  if (lineas.length === 0) return;
  await tx.insert(l).values(
    lineas.map((x, posicion) => ({
      tenantId: ctx.empresaId,
      versionId,
      posicion,
      productoId: x.productoId,
      listaId: x.listaId,
      descripcion: x.descripcion,
      unidad: x.unidad,
      cantidadMilesimas: x.cantidadMilesimas,
      precioUnitarioMilesimas: x.precioUnitarioMilesimas,
      importeCentimos: x.importeCentimos,
      igvCentimos: x.igvCentimos,
      totalCentimos: x.totalCentimos,
      origenPrecio: x.tipo,
      detalle: x.detalle,
    })),
  );
}

/** Copia las líneas de una versión a otra (nueva versión y duplicar): los mismos precios, sin recalcular. */
export async function copiarLineas(tx: Transaccion, ctx: ContextoDeEmpresa, deVersionId: string, aVersionId: string): Promise<void> {
  const origen = await lineasDe(tx, ctx, deVersionId);
  if (origen.length === 0) return;
  await tx.insert(l).values(origen.map(({ id: _id, creadoEn: _creadoEn, ...resto }) => ({ ...resto, versionId: aVersionId })));
}

export type CanalDeEvento = EventoDeCotizacion['canal'];

/** Por omisión el evento es de la pantalla y de la persona de `ctx`; desde el enlace público va con `{ canal: 'enlace', usuarioId: null }`. */
export async function registrarEvento(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  cotizacionId: string,
  version: number,
  evento: { tipo: TipoDeEventoDeCotizacion; motivo?: string | null; datos?: object; canal?: CanalDeEvento; usuarioId?: string | null },
): Promise<void> {
  await tx.insert(e).values({
    tenantId: ctx.empresaId,
    cotizacionId,
    version,
    tipo: evento.tipo,
    motivo: evento.motivo ?? null,
    datos: evento.datos ?? {},
    usuarioId: evento.usuarioId === undefined ? ctx.usuarioId : evento.usuarioId,
    canal: evento.canal ?? 'ui',
  });
}

const MAXIMO_DE_HISTORIAL = 200;

/** Lo más reciente primero. */
export async function historialDe(tx: Transaccion, ctx: ContextoDeEmpresa, cotizacionId: string): Promise<EventoDeCotizacion[]> {
  return tx
    .select()
    .from(e)
    .where(and(eq(e.tenantId, ctx.empresaId), eq(e.cotizacionId, cotizacionId)))
    .orderBy(desc(e.creadoEn), desc(e.id))
    .limit(MAXIMO_DE_HISTORIAL);
}
