import { and, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type { Borrador, ListarBorradores } from '@capaz/shared';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Toda consulta va dentro de `conEmpresa`: la RLS aísla por empresa; el `where` por id es solo el filtro.

type Fila = typeof borradores.$inferSelect;

const iso = (f: Date | null) => (f ? f.toISOString() : null);

export function comoBorrador(f: Fila): Borrador {
  return {
    id: f.id,
    herramienta: f.herramienta,
    modulo: f.modulo,
    args: f.args,
    argsOriginales: f.argsOriginales,
    resumen: f.resumen,
    origen: f.origen as Borrador['origen'],
    origenRef: f.origenRef,
    prioridad: f.prioridad as Borrador['prioridad'],
    estado: f.estado as Borrador['estado'],
    corregido: f.corregido,
    propuestoPor: f.propuestoPor,
    propuestoEn: f.propuestoEn.toISOString(),
    capturaIniciadaEn: iso(f.capturaIniciadaEn),
    resueltoPor: f.resueltoPor,
    resueltoEn: iso(f.resueltoEn),
    motivoDescarte: f.motivoDescarte,
  };
}

const codificar = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');
const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;

export function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

export type PaginaDeBorradores = { filas: Fila[]; siguiente: string | null };

/** `modulos`: solo los de módulos a los que la persona puede entrar. */
export async function listar(
  tx: Transaccion,
  filtros: ListarBorradores,
  modulos: readonly string[],
  cursor: { instante: string; id: string } | null,
): Promise<PaginaDeBorradores> {
  if (modulos.length === 0) return { filas: [], siguiente: null };
  const donde: (SQL | undefined)[] = [
    inArray(borradores.modulo, [...modulos]),
    filtros.estado ? eq(borradores.estado, filtros.estado) : undefined,
    filtros.modulo ? eq(borradores.modulo, filtros.modulo) : undefined,
    filtros.origen ? eq(borradores.origen, filtros.origen) : undefined,
    cursor ? sql`(${borradores.propuestoEn}, ${borradores.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select({ fila: borradores, instante: sql<string>`${borradores.propuestoEn}::text` })
    .from(borradores)
    .where(and(...donde))
    .orderBy(desc(borradores.propuestoEn), desc(borradores.id))
    .limit(filtros.limite + 1);
  const pagina = filas.slice(0, filtros.limite);
  const ultima = pagina.at(-1);
  return {
    filas: pagina.map((p) => p.fila),
    siguiente: filas.length > filtros.limite && ultima ? codificar(ultima.instante, ultima.fila.id) : null,
  };
}

/** `bloquear` toma la fila con `for update`: dos aprobaciones a la vez se turnan. */
export async function buscar(tx: Transaccion, id: string, bloquear = false): Promise<Fila | undefined> {
  const q = tx.select().from(borradores).where(eq(borradores.id, id)).limit(1);
  const [fila] = await (bloquear ? q.for('update') : q);
  return fila;
}

export async function guardarCorreccion(tx: Transaccion, id: string, args: Record<string, unknown>): Promise<Fila> {
  const [fila] = await tx.update(borradores).set({ args, corregido: true }).where(eq(borradores.id, id)).returning();
  if (!fila) throw new Error('No se pudo corregir el borrador.');
  return fila;
}

export async function marcarAprobado(tx: Transaccion, id: string, usuarioId: string): Promise<Fila> {
  const [fila] = await tx
    .update(borradores)
    .set({ estado: 'aprobado', resueltoPor: usuarioId, resueltoEn: sql`now()` })
    .where(and(eq(borradores.id, id), eq(borradores.estado, 'pendiente')))
    .returning();
  if (!fila) throw new Error('No se pudo marcar el borrador como aprobado.');
  return fila;
}

export async function marcarDescartado(tx: Transaccion, id: string, usuarioId: string, motivo: string): Promise<Fila> {
  const [fila] = await tx
    .update(borradores)
    .set({ estado: 'descartado', resueltoPor: usuarioId, resueltoEn: sql`now()`, motivoDescarte: motivo })
    .where(and(eq(borradores.id, id), eq(borradores.estado, 'pendiente')))
    .returning();
  if (!fila) throw new Error('No se pudo descartar el borrador.');
  return fila;
}

/** Cuenta los pendientes de esos módulos (y cuántos son de prioridad alta). Sin módulos, ceros. */
export async function contarPendientes(tx: Transaccion, modulos: readonly string[]): Promise<{ pendientes: number; deAltaPrioridad: number }> {
  if (modulos.length === 0) return { pendientes: 0, deAltaPrioridad: 0 };
  const [fila] = await tx
    .select({
      pendientes: sql<number>`count(*)::int`,
      deAltaPrioridad: sql<number>`(count(*) filter (where ${borradores.prioridad} = 'alta'))::int`,
    })
    .from(borradores)
    .where(and(eq(borradores.estado, 'pendiente'), inArray(borradores.modulo, [...modulos])));
  return { pendientes: fila?.pendientes ?? 0, deAltaPrioridad: fila?.deAltaPrioridad ?? 0 };
}
