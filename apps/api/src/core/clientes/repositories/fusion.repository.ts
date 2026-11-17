import { and, eq, sql } from 'drizzle-orm';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { clienteComercial, clienteContactos, clienteDirecciones } from '../../../db/esquema/core-maestros-ampliados.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import type { Cliente } from './clientes.repository.js';

// Fusión de clientes: lo que cada tabla de otros módulos tiene apuntando al repetido se descubre en el catálogo de la base
// (llaves foráneas hacia `core.clientes`), de modo que una tabla nueva entra sola. Solo lo usa `clientes_fusionar`.

export type Referencia = { esquema: string; tabla: string; columna: string };

/** Las columnas de otros esquemas que apuntan a un cliente (`(tenant_id, columna)` → `core.clientes`). */
export async function referenciasAClientes(tx: Transaccion): Promise<Referencia[]> {
  const r = await tx.execute<{ esquema: string; tabla: string; columna: string }>(sql`
    select n.nspname as esquema, c.relname as tabla, a.attname as columna
    from pg_constraint k
    join pg_class c on c.oid = k.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
    where k.contype = 'f' and k.confrelid = 'core.clientes'::regclass
      and n.nspname <> 'core' and a.attname <> 'tenant_id'
    order by 1, 2, 3`);
  return r.rows;
}

/** Una tabla de solo inserción (el rol de la aplicación no tiene `update`): su historial no se reescribe, tampoco al fusionar. */
export async function esDeSoloInsercion(tx: Transaccion, r: Referencia): Promise<boolean> {
  const f = await tx.execute<{ puede: boolean }>(sql`select has_table_privilege(current_user, format('%I.%I', ${r.esquema}::text, ${r.tabla}::text), 'UPDATE') as puede`);
  return f.rows[0]?.puede !== true;
}

const tabla = (r: Referencia) => sql`${sql.identifier(r.esquema)}.${sql.identifier(r.tabla)}`;

export async function contarReferencias(tx: Transaccion, r: Referencia, id: string): Promise<number> {
  const f = await tx.execute<{ n: string }>(sql`select count(*)::text as n from ${tabla(r)} where tenant_id = current_setting('app.tenant_id', true) and ${sql.identifier(r.columna)} = ${id}`);
  return Number(f.rows[0]?.n ?? 0);
}

export async function reasignar(tx: Transaccion, r: Referencia, origenId: string, destinoId: string): Promise<number> {
  const f = await tx.execute(sql`update ${tabla(r)} set ${sql.identifier(r.columna)} = ${destinoId} where tenant_id = current_setting('app.tenant_id', true) and ${sql.identifier(r.columna)} = ${origenId}`);
  return f.rowCount ?? 0;
}

/** Toma las dos filas con bloqueo, en orden de id (dos fusiones cruzadas no se bloquean entre sí). */
export async function tomarPar(tx: Transaccion, ctx: ContextoDeEmpresa, a: string, b: string): Promise<Map<string, Cliente>> {
  const filas = await tx
    .select()
    .from(clientes)
    .where(and(eq(clientes.tenantId, ctx.empresaId), sql`${clientes.id} in (${a}, ${b})`))
    .orderBy(clientes.id)
    .for('update');
  return new Map(filas.map((f) => [f.id, f]));
}

/** La ficha comercial: si el destino no tiene, hereda la del repetido; si tiene, se queda con la suya. */
export async function moverComercial(tx: Transaccion, ctx: ContextoDeEmpresa, origenId: string, destinoId: string): Promise<void> {
  const donde = (id: string) => and(eq(clienteComercial.tenantId, ctx.empresaId), eq(clienteComercial.clienteId, id));
  const [propia] = await tx.select({ id: clienteComercial.clienteId }).from(clienteComercial).where(donde(destinoId));
  if (propia) await tx.delete(clienteComercial).where(donde(origenId));
  else await tx.update(clienteComercial).set({ clienteId: destinoId }).where(donde(origenId));
}

/** Contactos y direcciones pasan al destino sin ser «principal» (el destino ya tiene el suyo). Devuelve cuántos movió. */
export async function moverContactosYDirecciones(tx: Transaccion, ctx: ContextoDeEmpresa, origenId: string, destinoId: string): Promise<number> {
  const c = await tx
    .update(clienteContactos)
    .set({ clienteId: destinoId, esPrincipal: false })
    .where(and(eq(clienteContactos.tenantId, ctx.empresaId), eq(clienteContactos.clienteId, origenId)))
    .returning({ id: clienteContactos.id });
  const d = await tx
    .update(clienteDirecciones)
    .set({ clienteId: destinoId, esPrincipal: false })
    .where(and(eq(clienteDirecciones.tenantId, ctx.empresaId), eq(clienteDirecciones.clienteId, origenId)))
    .returning({ id: clienteDirecciones.id });
  return c.length + d.length;
}

export async function marcarFusionado(tx: Transaccion, ctx: ContextoDeEmpresa, origenId: string, destinoId: string): Promise<void> {
  await tx
    .update(clientes)
    .set({ fusionadoEn: destinoId, archivadoEn: sql`coalesce(${clientes.archivadoEn}, now())`, actualizadoEn: sql`now()` })
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, origenId)));
}

export async function completarDestino(tx: Transaccion, ctx: ContextoDeEmpresa, destinoId: string, cambios: Partial<Pick<Cliente, 'documentoTipo' | 'documentoNumero' | 'telefono' | 'correo' | 'direccion' | 'tipo'>>): Promise<void> {
  if (Object.keys(cambios).length === 0) return;
  await tx
    .update(clientes)
    .set({ ...cambios, actualizadoEn: sql`now()` })
    .where(and(eq(clientes.tenantId, ctx.empresaId), eq(clientes.id, destinoId)));
}

export type ParParecido = { aId: string; aNombre: string; aDocumento: string | null; aTipo: string; bId: string; bNombre: string; bDocumento: string | null; bTipo: string; similitud: number };

/** Pares de clientes activos cuyo nombre se parece al menos `umbral` (pg_trgm), del más parecido al menos. */
export async function paresParecidos(tx: Transaccion, ctx: ContextoDeEmpresa, umbral: number, limite: number): Promise<ParParecido[]> {
  await tx.execute(sql`select set_config('pg_trgm.similarity_threshold', ${String(umbral)}, true)`);
  const r = await tx.execute<{ a_id: string; a_nombre: string; a_documento: string | null; a_tipo: string; b_id: string; b_nombre: string; b_documento: string | null; b_tipo: string; similitud: number }>(sql`
    select a.id as a_id, a.nombre as a_nombre, a.documento_numero as a_documento, a.tipo as a_tipo,
           b.id as b_id, b.nombre as b_nombre, b.documento_numero as b_documento, b.tipo as b_tipo,
           similarity(a.nombre_normalizado, b.nombre_normalizado)::float8 as similitud
    from core.clientes a
    join core.clientes b on b.tenant_id = a.tenant_id and a.id < b.id and a.nombre_normalizado % b.nombre_normalizado
    where a.tenant_id = ${ctx.empresaId} and a.archivado_en is null and b.archivado_en is null
      and a.fusionado_en is null and b.fusionado_en is null
    order by similitud desc, a.nombre_normalizado, a.id
    limit ${limite}`);
  return r.rows.map((x) => ({ aId: x.a_id, aNombre: x.a_nombre, aDocumento: x.a_documento, aTipo: x.a_tipo, bId: x.b_id, bNombre: x.b_nombre, bDocumento: x.b_documento, bTipo: x.b_tipo, similitud: Number(x.similitud) }));
}
