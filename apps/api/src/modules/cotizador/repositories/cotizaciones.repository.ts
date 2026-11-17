import { and, desc, eq, getTableColumns, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { clientes, productos } from '../../../db/esquema/core-maestros.js';
import { cotizadorCotizaciones, cotizadorListasDePrecio, cotizadorVersiones } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { ListaDeLinea } from '../domain/lineas.js';

// Repositorio de cotizaciones (la cabecera). Recibe la transacción del ejecutor: la RLS aísla y el `where` por
// empresa es defensa en profundidad. `alcance: 'propios'` limita a lo que la persona creó (R4).

const c = cotizadorCotizaciones;
const v = cotizadorVersiones;
export type Alcance = 'todos' | 'propios';
export type Cotizacion = typeof c.$inferSelect & { clienteNombreVivo: string | null };
/** La cabecera con los totales de su versión vigente (lo que muestra un listado). */
export type CotizacionConTotales = Cotizacion & {
  conOpciones: boolean;
  igvPorcentaje: number;
  subtotalCentimos: number;
  igvCentimos: number;
  totalCentimos: number;
  cantidadDeLineas: number;
};
export type CambiosDeCotizacion = Partial<
  Pick<
    typeof c.$inferInsert,
    | 'titulo' | 'clienteId' | 'clienteNombre' | 'notas' | 'estado' | 'numero' | 'anio' | 'versionActual' | 'validaHasta' | 'lineasAceptadas'
    | 'totalAceptadoCentimos' | 'aceptadaEn' | 'motivoRechazo' | 'anuladoEn' | 'anuladoPor' | 'motivoAnulacion'
  >
>;

const deEmpresa = (ctx: ContextoDeEmpresa) => eq(c.tenantId, ctx.empresaId);
const deAlcance = (ctx: ContextoDeEmpresa, alcance: Alcance): SQL | undefined => (alcance === 'propios' ? eq(c.creadoPor, ctx.usuarioId) : undefined);
const conCliente = and(eq(clientes.tenantId, c.tenantId), eq(clientes.id, c.clienteId));
const columnas = { ...getTableColumns(c), clienteNombreVivo: clientes.nombre };

/** Con `bloquear`, la fila se toma primero con `for update` (dos cambios a la vez se turnan) y después se lee. */
export async function verCotizacion(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, o: { alcance: Alcance; bloquear?: boolean }): Promise<Cotizacion | null> {
  const donde = and(deEmpresa(ctx), eq(c.id, id), deAlcance(ctx, o.alcance));
  if (o.bloquear) {
    const tomada = await tx.select({ id: c.id }).from(c).where(donde).for('update');
    if (tomada.length === 0) return null;
  }
  const [fila] = await tx.select(columnas).from(c).leftJoin(clientes, conCliente).where(donde);
  return fila ?? null;
}

export type DatosDeCotizacion = { titulo: string; clienteId: string | null; notas: string | null };

export async function crearCotizacion(tx: Transaccion, ctx: ContextoDeEmpresa, d: DatosDeCotizacion): Promise<string> {
  const [fila] = await tx.insert(c).values({ ...d, tenantId: ctx.empresaId, creadoPor: ctx.usuarioId }).returning({ id: c.id });
  if (!fila) throw new Error('No se pudo crear la cotización.');
  return fila.id;
}

export async function actualizarCotizacion(tx: Transaccion, ctx: ContextoDeEmpresa, id: string, cambios: CambiosDeCotizacion): Promise<void> {
  const r = await tx.update(c).set({ ...cambios, actualizadoEn: sql`now()` }).where(and(deEmpresa(ctx), eq(c.id, id))).returning({ id: c.id });
  if (r.length !== 1) throw new Error('No se pudo actualizar la cotización.');
}

// --- Listado con cursor por instante (creado_en, id) descendente ---

const codificarCursor = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');
const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;
function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}
const sinComodines = (t: string) => t.replace(/[\\%_]/g, (x) => `\\${x}`);

export type FiltrosDeCotizaciones = { limite: number; cursor?: string; estado: string; clienteId?: string; buscar?: string };

function filtroDeEstado(estado: string): SQL | undefined {
  if (estado === 'todas') return undefined;
  if (estado === 'abiertas') return inArray(c.estado, ['borrador', 'emitida', 'enviada']);
  return eq(c.estado, estado);
}

const conVersion = and(eq(v.tenantId, c.tenantId), eq(v.cotizacionId, c.id), eq(v.version, c.versionActual));
const cantidadDeLineas = sql<number>`(select count(*)::int from cotizador.version_lineas l where l.tenant_id = ${v.tenantId} and l.version_id = ${v.id})`;

export async function listarCotizaciones(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  f: FiltrosDeCotizaciones,
): Promise<{ items: CotizacionConTotales[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = f.cursor ? decodificarCursor(f.cursor) : null;
  if (f.cursor && !pos) return 'cursor_invalido';
  const buscar = f.buscar ? `%${sinComodines(f.buscar)}%` : null;
  const filas = await tx
    .select({
      ...columnas,
      conOpciones: v.conOpciones,
      igvPorcentaje: v.igvPorcentaje,
      subtotalCentimos: v.subtotalCentimos,
      igvCentimos: v.igvCentimos,
      totalCentimos: v.totalCentimos,
      cantidadDeLineas,
      instante: sql<string>`${c.creadoEn}::text`,
    })
    .from(c)
    .innerJoin(v, conVersion)
    .leftJoin(clientes, conCliente)
    .where(
      and(
        deEmpresa(ctx),
        deAlcance(ctx, alcance),
        filtroDeEstado(f.estado),
        f.clienteId ? eq(c.clienteId, f.clienteId) : undefined,
        buscar ? or(ilike(c.titulo, buscar), ilike(c.clienteNombre, buscar), ilike(clientes.nombre, buscar)) : undefined,
        pos ? sql`(${c.creadoEn}, ${c.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(c.creadoEn), desc(c.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(({ instante: _instante, ...x }) => x),
    siguiente: filas.length > f.limite && ultima ? codificarCursor(ultima.instante, ultima.id) : null,
  };
}

/** Los totales de la versión vigente de una cotización ya leída. */
export async function totalesVigentes(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<CotizacionConTotales | null> {
  const [fila] = await tx
    .select({ ...columnas, conOpciones: v.conOpciones, igvPorcentaje: v.igvPorcentaje, subtotalCentimos: v.subtotalCentimos, igvCentimos: v.igvCentimos, totalCentimos: v.totalCentimos, cantidadDeLineas })
    .from(c)
    .innerJoin(v, conVersion)
    .leftJoin(clientes, conCliente)
    .where(and(deEmpresa(ctx), eq(c.id, id)));
  return fila ?? null;
}

// --- Lo que una cotización necesita del núcleo y de la lista de precios ---

export async function clienteVigente(tx: Transaccion, ctx: ContextoDeEmpresa, id: string): Promise<{ nombre: string } | null> {
  const [fila] = await tx
    .select({ nombre: clientes.nombre })
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, id), sql`${clientes.archivadoEn} is null`, sql`${clientes.fusionadoEn} is null`));
  return fila ?? null;
}

/** Las listas citadas por unas líneas (también las archivadas: la herramienta decide). */
export async function listasParaLineas(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<Map<string, ListaDeLinea>> {
  if (ids.length === 0) return new Map();
  const l = cotizadorListasDePrecio;
  const filas = await tx.select().from(l).where(and(eq(l.tenantId, ctx.empresaId), inArray(l.id, [...new Set(ids)])));
  return new Map(
    filas.map((f) => [
      f.id,
      {
        id: f.id,
        nombre: f.nombre,
        unidad: f.unidad,
        productoId: f.productoId,
        archivada: f.archivadoEn !== null,
        p100Centimos: f.p100Centimos,
        p1000Centimos: f.p1000Centimos,
        p5000Centimos: f.p5000Centimos,
        modoIntermedio: f.modoIntermedio as 'curva' | 'escalon',
        precioMinimoCentimos: f.precioMinimoCentimos,
      },
    ]),
  );
}

/** ¿Todos esos productos existen en la empresa y no están archivados? */
export async function productosVigentes(tx: Transaccion, ctx: ContextoDeEmpresa, ids: readonly string[]): Promise<boolean> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return true;
  const filas = await tx.select({ id: productos.id }).from(productos).where(and(eq(productos.tenantId, ctx.empresaId), inArray(productos.id, unicos), isNull(productos.archivadoEn)));
  return filas.length === unicos.length;
}
