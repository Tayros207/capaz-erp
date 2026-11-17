import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { cotizadorCotizaciones, cotizadorListasDePrecio, cotizadorVersionLineas, cotizadorVersiones } from '../../../db/esquema/cotizador.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeCotizacion } from '../domain/cotizacion.js';
import type { Alcance } from './cotizaciones.repository.js';

// Origen de una lista de precios (la cotización por partes de la que salieron sus referencias) e historial por
// producto (las cotizaciones con líneas de esa lista). Recibe la transacción de `conEmpresa`.

const l = cotizadorListasDePrecio;
const c = cotizadorCotizaciones;
const v = cotizadorVersiones;
const ln = cotizadorVersionLineas;

export type OrigenDeLista = { cotizacionId: string; version: number };

/**
 * Anota de qué cotización por partes (y versión) salieron las referencias de la lista. `false` si la lista o la
 * cotización no existen en esta empresa. Lo llama `cuadro_guardar_referencias` (carril del cuadro) dentro de su transacción.
 */
export async function fijarOrigenDeLista(tx: Transaccion, ctx: ContextoDeEmpresa, listaId: string, origen: OrigenDeLista): Promise<boolean> {
  const [existe] = await tx.select({ id: c.id }).from(c).where(and(eq(c.tenantId, ctx.empresaId), eq(c.id, origen.cotizacionId)));
  if (!existe) return false;
  const r = await tx
    .update(l)
    .set({ origenCotizacionId: origen.cotizacionId, origenVersion: origen.version, actualizadoEn: sql`now()` })
    .where(and(eq(l.tenantId, ctx.empresaId), eq(l.id, listaId)))
    .returning({ id: l.id });
  return r.length === 1;
}

/** Los códigos («COT-2026-0001 v2») de los orígenes, con una sola consulta. Clave: `cotizacionId|version`. */
export async function codigosDeOrigen(tx: Transaccion, ctx: ContextoDeEmpresa, refs: OrigenDeLista[]): Promise<Map<string, string>> {
  const ids = [...new Set(refs.map((r) => r.cotizacionId))];
  if (ids.length === 0) return new Map();
  const filas = await tx.select({ id: c.id, numero: c.numero, anio: c.anio }).from(c).where(and(eq(c.tenantId, ctx.empresaId), inArray(c.id, ids)));
  const porId = new Map(filas.map((f) => [f.id, f]));
  const salida = new Map<string, string>();
  for (const r of refs) {
    const f = porId.get(r.cotizacionId);
    if (f) salida.set(claveDeOrigen(r), codigoDeCotizacion(f.numero, f.anio, r.version));
  }
  return salida;
}
export const claveDeOrigen = (r: OrigenDeLista): string => `${r.cotizacionId}|${r.version}`;

export type FilaDeHistorial = {
  lineaId: string;
  cotizacionId: string;
  numero: number | null;
  anio: number | null;
  titulo: string;
  estado: string;
  clienteNombre: string | null;
  version: number;
  fecha: Date;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  importeCentimos: number;
};

const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;
const codificar = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');
function decodificar(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

/** Las líneas de cotizaciones que usaron la lista, de la más reciente a la más antigua (fecha de la versión, id de la línea). */
export async function historialDeLista(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  alcance: Alcance,
  listaId: string,
  o: { limite: number; cursor?: string },
): Promise<{ items: FilaDeHistorial[]; siguiente: string | null } | 'cursor_invalido'> {
  const pos = o.cursor ? decodificar(o.cursor) : null;
  if (o.cursor && !pos) return 'cursor_invalido';
  const filas = await tx
    .select({
      lineaId: ln.id,
      cotizacionId: c.id,
      numero: c.numero,
      anio: c.anio,
      titulo: c.titulo,
      estado: c.estado,
      clienteNombre: sql<string | null>`coalesce(${c.clienteNombre}, ${clientes.nombre})`,
      version: v.version,
      fecha: v.creadoEn,
      instante: sql<string>`${v.creadoEn}::text`,
      cantidadMilesimas: ln.cantidadMilesimas,
      precioUnitarioMilesimas: ln.precioUnitarioMilesimas,
      importeCentimos: ln.importeCentimos,
    })
    .from(ln)
    .innerJoin(v, and(eq(v.tenantId, ln.tenantId), eq(v.id, ln.versionId)))
    .innerJoin(c, and(eq(c.tenantId, v.tenantId), eq(c.id, v.cotizacionId)))
    .leftJoin(clientes, and(eq(clientes.tenantId, c.tenantId), eq(clientes.id, c.clienteId)))
    .where(
      and(
        eq(ln.tenantId, ctx.empresaId),
        eq(ln.listaId, listaId),
        alcance === 'propios' ? eq(c.creadoPor, ctx.usuarioId) : undefined,
        pos ? sql`(${v.creadoEn}, ${ln.id}) < (${pos.instante}::timestamptz, ${pos.id}::uuid)` : undefined,
      ),
    )
    .orderBy(desc(v.creadoEn), desc(ln.id))
    .limit(o.limite + 1);
  const pagina = filas.slice(0, o.limite);
  const ultima = pagina.at(-1);
  return {
    items: pagina.map(({ instante: _i, ...x }) => x),
    siguiente: filas.length > o.limite && ultima ? codificar(ultima.instante, ultima.lineaId) : null,
  };
}
