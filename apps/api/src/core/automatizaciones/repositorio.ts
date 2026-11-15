import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import type { Accion, Condicion, Disparador, EjecucionDeRegla, Regla } from '@capaz/shared';
import { reglasAutomaticas, reglasDisparos, reglasEjecuciones } from '../../db/esquema/core-automatizaciones.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Toda consulta va dentro de `conEmpresa`: la RLS aísla por empresa. Nada borra: se archiva o se desactiva.

export type FilaDeRegla = typeof reglasAutomaticas.$inferSelect;
type FilaDeEjecucion = typeof reglasEjecuciones.$inferSelect;
type Resultado = EjecucionDeRegla['resultado'];

export function comoRegla(f: FilaDeRegla): Regla {
  return {
    id: f.id,
    nombre: f.nombre,
    descripcion: f.descripcion,
    activa: f.activa,
    disparador: f.disparador as Disparador,
    condiciones: f.condiciones as Condicion[],
    acciones: f.acciones as Accion[],
    modo: f.modo as Regla['modo'],
    limiteDiario: f.limiteDiario,
    creadoPor: f.creadoPor,
    creadoEn: f.creadoEn.toISOString(),
    actualizadoEn: f.actualizadoEn.toISOString(),
  };
}

export function comoEjecucion(f: FilaDeEjecucion): EjecucionDeRegla {
  return {
    id: f.id,
    reglaId: f.reglaId,
    disparadoPor: f.disparadoPor as Record<string, unknown>,
    simulada: f.simulada,
    resultado: f.resultado as Resultado,
    detalle: f.detalle ?? null,
    borradorId: f.borradorId,
    creadoEn: f.creadoEn.toISOString(),
  };
}

const codificar = (instante: string, id: string) => Buffer.from(`${instante}|${id}`).toString('base64url');
const FORMA_DE_CURSOR = /^(.+)\|([0-9a-f-]{36})$/;
export function decodificarCursor(cursor: string): { instante: string; id: string } | null {
  const m = FORMA_DE_CURSOR.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return m?.[1] && m[2] && !Number.isNaN(Date.parse(m[1])) ? { instante: m[1], id: m[2] } : null;
}

export async function buscar(tx: Transaccion, id: string, bloquear = false): Promise<FilaDeRegla | undefined> {
  const q = tx
    .select()
    .from(reglasAutomaticas)
    .where(and(eq(reglasAutomaticas.id, id), isNull(reglasAutomaticas.archivadoEn)))
    .limit(1);
  const [fila] = await (bloquear ? q.for('update') : q);
  return fila;
}

export async function listar(
  tx: Transaccion,
  f: { limite: number; activa?: boolean; disparador?: string },
  cursor: { instante: string; id: string } | null,
): Promise<{ filas: FilaDeRegla[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    isNull(reglasAutomaticas.archivadoEn),
    f.activa === undefined ? undefined : eq(reglasAutomaticas.activa, f.activa),
    f.disparador ? eq(reglasAutomaticas.disparadorTipo, f.disparador) : undefined,
    cursor ? sql`(${reglasAutomaticas.creadoEn}, ${reglasAutomaticas.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select({ fila: reglasAutomaticas, instante: sql<string>`${reglasAutomaticas.creadoEn}::text` })
    .from(reglasAutomaticas)
    .where(and(...donde))
    .orderBy(desc(reglasAutomaticas.creadoEn), desc(reglasAutomaticas.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return { filas: pagina.map((p) => p.fila), siguiente: filas.length > f.limite && ultima ? codificar(ultima.instante, ultima.fila.id) : null };
}

/** Reglas activas de un tipo de disparador (el tipo de evento o la fuente se filtran en el motor). */
export async function activasDeTipo(tx: Transaccion, tipo: Disparador['tipo']): Promise<FilaDeRegla[]> {
  return tx
    .select()
    .from(reglasAutomaticas)
    .where(and(eq(reglasAutomaticas.activa, true), eq(reglasAutomaticas.disparadorTipo, tipo), isNull(reglasAutomaticas.archivadoEn)))
    .orderBy(reglasAutomaticas.creadoEn, reglasAutomaticas.id);
}

export type DefinicionDeRegla = {
  nombre: string;
  descripcion: string | null;
  disparador: Disparador;
  condiciones: Condicion[];
  acciones: Accion[];
  modo: Regla['modo'];
  limiteDiario: number;
};

export async function crear(tx: Transaccion, d: DefinicionDeRegla, creadoPor: string): Promise<FilaDeRegla> {
  const [fila] = await tx
    .insert(reglasAutomaticas)
    .values({
      tenantId: sql`current_setting('app.tenant_id', true)`,
      nombre: d.nombre,
      descripcion: d.descripcion,
      activa: false,
      disparadorTipo: d.disparador.tipo,
      disparador: d.disparador,
      condiciones: d.condiciones,
      acciones: d.acciones,
      modo: d.modo,
      limiteDiario: d.limiteDiario,
      creadoPor,
    })
    .returning();
  if (!fila) throw new Error('No se pudo guardar la regla.');
  return fila;
}

/** Reemplaza la definición. `activa` solo se pasa para apagarla. */
export async function reemplazar(tx: Transaccion, id: string, d: DefinicionDeRegla, apagar: boolean): Promise<FilaDeRegla> {
  const [fila] = await tx
    .update(reglasAutomaticas)
    .set({
      nombre: d.nombre,
      descripcion: d.descripcion,
      disparadorTipo: d.disparador.tipo,
      disparador: d.disparador,
      condiciones: d.condiciones,
      acciones: d.acciones,
      modo: d.modo,
      limiteDiario: d.limiteDiario,
      ...(apagar ? { activa: false } : {}),
    })
    .where(eq(reglasAutomaticas.id, id))
    .returning();
  if (!fila) throw new Error('No se pudo actualizar la regla.');
  return fila;
}

export async function fijarActiva(tx: Transaccion, id: string, activa: boolean): Promise<FilaDeRegla> {
  const [fila] = await tx.update(reglasAutomaticas).set({ activa }).where(eq(reglasAutomaticas.id, id)).returning();
  if (!fila) throw new Error('No se pudo cambiar el estado de la regla.');
  return fila;
}

export async function zonaHorariaDeLaEmpresa(tx: Transaccion): Promise<string> {
  const r = await tx.execute<{ zona_horaria: string }>(sql`select zona_horaria from core.empresa_config limit 1`);
  return r.rows[0]?.zona_horaria ?? 'America/Lima';
}

/** Ejecuciones reales de hoy (día en la zona de la empresa) que gastan límite: todas menos las omitidas. */
export async function contarDeHoy(tx: Transaccion, reglaId: string, ahora: Date, zona: string): Promise<number> {
  const r = await tx.execute<{ n: number }>(
    sql`select count(*)::int as n from core.reglas_ejecuciones
         where regla_id = ${reglaId} and not simulada and resultado <> 'omitida_por_limite'
           and (creado_en at time zone ${zona})::date = (${ahora.toISOString()}::timestamptz at time zone ${zona})::date`,
  );
  return r.rows[0]?.n ?? 0;
}

export async function registrarEjecucion(
  tx: Transaccion,
  e: { reglaId: string; disparadoPor: Record<string, unknown>; simulada: boolean; resultado: Resultado; detalle?: unknown; borradorId?: string | null; ahora: Date },
): Promise<FilaDeEjecucion> {
  const [fila] = await tx
    .insert(reglasEjecuciones)
    .values({
      tenantId: sql`current_setting('app.tenant_id', true)`,
      reglaId: e.reglaId,
      disparadoPor: e.disparadoPor,
      simulada: e.simulada,
      resultado: e.resultado,
      detalle: e.detalle ?? null,
      borradorId: e.borradorId ?? null,
      creadoEn: e.ahora,
    })
    .returning();
  if (!fila) throw new Error('No se pudo registrar la ejecución.');
  return fila;
}

/** Reclama el disparo (regla + clave). Verdadero solo la primera vez: la segunda corrida no hace nada. */
export async function reclamarDisparo(tx: Transaccion, reglaId: string, clave: string, ahora: Date): Promise<boolean> {
  const r = await tx
    .insert(reglasDisparos)
    .values({ tenantId: sql`current_setting('app.tenant_id', true)`, reglaId, clave, creadoEn: ahora })
    .onConflictDoNothing()
    .returning({ clave: reglasDisparos.clave });
  return r.length > 0;
}

export async function listarEjecuciones(
  tx: Transaccion,
  f: { limite: number; reglaId?: string; simulada?: boolean; resultado?: string },
  cursor: { instante: string; id: string } | null,
): Promise<{ filas: FilaDeEjecucion[]; siguiente: string | null }> {
  const donde: (SQL | undefined)[] = [
    f.reglaId ? eq(reglasEjecuciones.reglaId, f.reglaId) : undefined,
    f.simulada === undefined ? undefined : eq(reglasEjecuciones.simulada, f.simulada),
    f.resultado ? eq(reglasEjecuciones.resultado, f.resultado) : undefined,
    cursor ? sql`(${reglasEjecuciones.creadoEn}, ${reglasEjecuciones.id}) < (${cursor.instante}::timestamptz, ${cursor.id}::uuid)` : undefined,
  ];
  const filas = await tx
    .select({ fila: reglasEjecuciones, instante: sql<string>`${reglasEjecuciones.creadoEn}::text` })
    .from(reglasEjecuciones)
    .where(and(...donde))
    .orderBy(desc(reglasEjecuciones.creadoEn), desc(reglasEjecuciones.id))
    .limit(f.limite + 1);
  const pagina = filas.slice(0, f.limite);
  const ultima = pagina.at(-1);
  return { filas: pagina.map((p) => p.fila), siguiente: filas.length > f.limite && ultima ? codificar(ultima.instante, ultima.fila.id) : null };
}
