import { and, eq, inArray, sql } from 'drizzle-orm';
import { borradores } from '../../db/esquema/core-automatizaciones.js';
import { agenteAcciones } from '../../db/esquema/core-agente.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { DatosDeHuellaDeEjecucion } from '../herramientas/ejecutor.js';
import type { FilaDeHuella } from './tipos-del-turno.js';

// La huella del asistente: qué hizo, con qué argumentos, sobre qué y con qué resultado. Solo inserción (la tabla es inmutable).
// Una acción que se ejecutó la escribe el ejecutor DENTRO de su transacción (no hay acción sin huella); lo demás (rechazos,
// confirmaciones pendientes, borradores propuestos) se escribe aparte, en su propia transacción corta.

const TENANT = sql`current_setting('app.tenant_id', true)`;
const USUARIO = sql`current_setting('app.user_id', true)`;

type OrigenDelTurno = { modelo: string; conversacionId: string; turnoId: string };

export async function escribirHuellaDeAccion(tx: Transaccion, o: OrigenDelTurno & { ronda: number; indice: number; politica: 'directo' | 'dinero' | 'confirmada' }, d: DatosDeHuellaDeEjecucion): Promise<void> {
  await tx.insert(agenteAcciones).values({
    tenantId: TENANT, usuarioId: USUARIO, modelo: o.modelo, conversacionId: o.conversacionId, turnoId: o.turnoId, ronda: o.ronda, indice: o.indice,
    herramienta: d.herramienta, politica: o.politica === 'confirmada' ? 'confirmada' : 'directo', resultado: 'ok', codigo: null, hashArgs: d.hashArgs,
    args: argumentosParaLaHuella(d.herramienta, d.args), despues: d.despues ?? null, resumenConfirmado: d.resumenConfirmado,
  });
}

export async function escribirHuellaAparte(tx: Transaccion, o: OrigenDelTurno, f: FilaDeHuella): Promise<void> {
  await tx.insert(agenteAcciones).values({
    tenantId: TENANT, usuarioId: USUARIO, modelo: o.modelo, conversacionId: o.conversacionId, turnoId: o.turnoId, ronda: f.ronda, indice: f.indice,
    herramienta: f.herramienta, politica: f.politica, resultado: f.resultado, codigo: f.codigo, hashArgs: f.hashArgs, args: argumentosParaLaHuella(f.herramienta, f.args), resumenConfirmado: f.resumenConfirmado,
  });
}

/** Lo que se dictó o escribió a mano nunca se guarda en la huella (el borrador ya lo lleva con sus propias reglas de privacidad). */
const SIN_ARGUMENTOS_EN_LA_HUELLA: ReadonlySet<string> = new Set(['captura_proponer']);
const argumentosParaLaHuella = (herramienta: string, args: unknown): unknown => (SIN_ARGUMENTOS_EN_LA_HUELLA.has(herramienta) ? { redactado: true } : (args ?? {}));

/** Los argumentos de lo que esta persona hizo con éxito con esta herramienta en los últimos minutos (para comparar la operación). */
export async function argumentosRecientes(tx: Transaccion, herramienta: string, minutos = 10): Promise<unknown[]> {
  const filas = await tx
    .select({ args: agenteAcciones.args })
    .from(agenteAcciones)
    .where(and(eq(agenteAcciones.tenantId, TENANT), eq(agenteAcciones.usuarioId, USUARIO), eq(agenteAcciones.herramienta, herramienta), eq(agenteAcciones.resultado, 'ok'), sql`${agenteAcciones.creadoEn} > now() - make_interval(mins => ${minutos})`))
    .limit(200);
  return filas.map((f) => f.args);
}

/** Los argumentos de lo de dinero que esta persona hizo por el asistente en las últimas 24 horas. */
export async function argumentosDelDia(tx: Transaccion, herramientas: readonly string[]): Promise<unknown[]> {
  if (herramientas.length === 0) return [];
  const filas = await tx
    .select({ args: agenteAcciones.args })
    .from(agenteAcciones)
    .where(and(eq(agenteAcciones.tenantId, TENANT), eq(agenteAcciones.usuarioId, USUARIO), eq(agenteAcciones.resultado, 'ok'), inArray(agenteAcciones.herramienta, [...herramientas]), sql`${agenteAcciones.creadoEn} > now() - interval '24 hours'`))
    .limit(500);
  return filas.map((f) => f.args);
}

/** ¿Hay una propuesta pendiente DEL SISTEMA (no del asistente) de esta herramienta para el mismo cliente o el mismo origen? */
export async function hayPropuestaPendienteDelSistema(tx: Transaccion, herramienta: string, args: unknown): Promise<boolean> {
  const a = args !== null && typeof args === 'object' ? (args as Record<string, unknown>) : {};
  const contacto = typeof a.contactoId === 'string' ? a.contactoId : null;
  const origen = typeof a.origenId === 'string' ? a.origenId : null;
  if (!contacto && !origen) return false;
  const coincide = [contacto ? sql`${borradores.args}->>'contactoId' = ${contacto}` : null, origen ? sql`${borradores.args}->>'origenId' = ${origen}` : null].filter((x) => x !== null);
  const [fila] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(borradores)
    .where(and(eq(borradores.tenantId, TENANT), eq(borradores.herramienta, herramienta), eq(borradores.estado, 'pendiente'), sql`${borradores.origen} <> 'agente'`, sql`(${sql.join(coincide, sql` or `)})`));
  return (fila?.n ?? 0) > 0;
}
