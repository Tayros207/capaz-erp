import { and, desc, eq, lt, sql } from 'drizzle-orm';
import type { Leccion } from '@capaz/shared';
import { agenteAcciones, agenteLecciones } from '../../db/esquema/core-agente.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { AccionDelAgente } from '@capaz/shared';

// La memoria del asistente y la lectura de su huella. La aislación (empresa, y persona para las lecciones de alcance «persona»)
// la hace la base con RLS: aquí solo se filtra lo que la pantalla pide.

const TENANT = sql`current_setting('app.tenant_id', true)`;
const USUARIO = sql`current_setting('app.user_id', true)`;

export const TOPE_DE_LECCIONES_POR_PERSONA = 200;
export const TOPE_DE_LECCIONES_DE_LA_EMPRESA = 300;

type Fila = typeof agenteLecciones.$inferSelect;

export function comoLeccion(f: Fila): Leccion {
  return {
    id: f.id, alcance: f.alcance as Leccion['alcance'], usuarioId: f.usuarioId, tipo: f.tipo as Leccion['tipo'], clave: f.clave, texto: f.texto,
    herramienta: f.herramienta, estado: f.estado as Leccion['estado'], origen: f.origen as Leccion['origen'], conversacionId: f.conversacionId, turnoId: f.turnoId,
    usos: f.usos, ultimaVez: f.ultimaVez?.toISOString() ?? null, creadoEn: f.creadoEn.toISOString(),
  };
}

export type LeccionNueva = {
  tipo: Leccion['tipo']; clave: string; texto: string; herramienta: string | null; origen: Leccion['origen']; estado: Leccion['estado'];
  conversacionId?: string | null; turnoId?: string | null;
};

/** Guarda una lección de alcance «persona»; si la clave ya existe suma un uso y NO cambia su estado ni su texto (una archivada sigue archivada). */
export async function guardarLeccion(tx: Transaccion, l: LeccionNueva): Promise<{ fila: Fila; nueva: boolean } | { lleno: true }> {
  const [previa] = await tx.select().from(agenteLecciones).where(and(eq(agenteLecciones.tenantId, TENANT), eq(agenteLecciones.alcance, 'persona'), eq(agenteLecciones.usuarioId, USUARIO), eq(agenteLecciones.clave, l.clave)));
  if (previa) {
    const [fila] = await tx.update(agenteLecciones).set({ usos: sql`${agenteLecciones.usos} + 1`, ultimaVez: sql`now()` }).where(eq(agenteLecciones.id, previa.id)).returning();
    return { fila: fila ?? previa, nueva: false };
  }
  const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(agenteLecciones).where(and(eq(agenteLecciones.tenantId, TENANT), eq(agenteLecciones.alcance, 'persona'), eq(agenteLecciones.usuarioId, USUARIO), sql`${agenteLecciones.estado} <> 'archivada'`));
  if (n >= TOPE_DE_LECCIONES_POR_PERSONA) return { lleno: true };
  const [fila] = await tx.insert(agenteLecciones).values({ tenantId: TENANT, usuarioId: USUARIO, alcance: 'persona', ...l, conversacionId: l.conversacionId ?? null, turnoId: l.turnoId ?? null }).returning();
  if (!fila) throw new Error('No se pudo guardar la lección.');
  return { fila, nueva: true };
}

export async function listarLecciones(tx: Transaccion, f: { estado?: Leccion['estado']; limite: number; cursor?: string }): Promise<{ items: Leccion[]; siguiente: string | null }> {
  const filas = await tx
    .select()
    .from(agenteLecciones)
    .where(and(eq(agenteLecciones.tenantId, TENANT), f.estado ? eq(agenteLecciones.estado, f.estado) : undefined, f.cursor ? lt(agenteLecciones.id, f.cursor) : undefined))
    .orderBy(desc(agenteLecciones.id))
    .limit(f.limite + 1);
  const hay = filas.length > f.limite;
  const items = filas.slice(0, f.limite).map(comoLeccion);
  return { items, siguiente: hay ? (items.at(-1)?.id ?? null) : null };
}

export async function leerLeccion(tx: Transaccion, id: string): Promise<Fila | null> {
  const [fila] = await tx.select().from(agenteLecciones).where(and(eq(agenteLecciones.tenantId, TENANT), eq(agenteLecciones.id, id))).for('update');
  return fila ?? null;
}

export async function cambiarLeccion(tx: Transaccion, id: string, cambios: Partial<Pick<Fila, 'texto' | 'estado' | 'alcance'>>): Promise<Fila> {
  const [fila] = await tx.update(agenteLecciones).set(cambios).where(eq(agenteLecciones.id, id)).returning();
  if (!fila) throw new Error('No se pudo cambiar la lección.');
  return fila;
}

/** Las lecciones que se le muestran al asistente: vigentes, las de la persona y las de la empresa, las más nuevas primero (mostrarlas no las vuelve «más usadas»). */
export async function leccionesVigentes(tx: Transaccion, limite: number): Promise<Leccion[]> {
  const filas = await tx.select().from(agenteLecciones).where(and(eq(agenteLecciones.tenantId, TENANT), eq(agenteLecciones.estado, 'vigente'))).orderBy(desc(agenteLecciones.id)).limit(limite);
  return filas.map(comoLeccion);
}

/** Cada vez que una lección se le muestra al asistente cuenta como un uso. */
export async function contarUsoDeLecciones(tx: Transaccion, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await tx.update(agenteLecciones).set({ usos: sql`${agenteLecciones.usos} + 1`, ultimaVez: sql`now()` }).where(sql`${agenteLecciones.id} in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
}

export async function listarAcciones(tx: Transaccion, f: { limite: number; cursor?: string; herramienta?: string; politica?: string; resultado?: string; conversacionId?: string }): Promise<{ items: AccionDelAgente[]; siguiente: string | null }> {
  const a = agenteAcciones;
  const filas = await tx
    .select()
    .from(a)
    .where(and(eq(a.tenantId, TENANT), f.herramienta ? eq(a.herramienta, f.herramienta) : undefined, f.politica ? eq(a.politica, f.politica) : undefined, f.resultado ? eq(a.resultado, f.resultado) : undefined, f.conversacionId ? eq(a.conversacionId, f.conversacionId) : undefined, f.cursor ? lt(a.id, f.cursor) : undefined))
    .orderBy(desc(a.id))
    .limit(f.limite + 1);
  const hay = filas.length > f.limite;
  const items: AccionDelAgente[] = filas.slice(0, f.limite).map((x) => ({
    id: x.id, creadoEn: x.creadoEn.toISOString(), usuarioId: x.usuarioId, modelo: x.modelo, conversacionId: x.conversacionId, turnoId: x.turnoId, ronda: x.ronda, indice: x.indice,
    herramienta: x.herramienta, politica: x.politica as AccionDelAgente['politica'], resultado: x.resultado as AccionDelAgente['resultado'], codigo: x.codigo, args: x.args, antes: x.antes, despues: x.despues, resumenConfirmado: x.resumenConfirmado,
  }));
  return { items, siguiente: hay ? (items.at(-1)?.id ?? null) : null };
}
