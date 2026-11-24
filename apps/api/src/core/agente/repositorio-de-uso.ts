import { and, eq, sql } from 'drizzle-orm';
import { agenteConfiguracion, agenteMensajes, uso } from '../../db/esquema/core-agente.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

// Uso y costo del asistente, el tope mensual, el ritmo de turnos y la configuración de cada empresa. Todo en `core.uso` y
// `core.agente_configuracion`: en serverless cada instancia tiene su propia memoria, así que un contador local no limitaría nada.

const TENANT = sql`current_setting('app.tenant_id', true)`;
const USUARIO = sql`current_setting('app.user_id', true)`;

export type UsoParaGuardar = {
  origen: 'agente' | 'titulo' | 'captura';
  turnoId: string;
  modelo: string;
  tokensEntrada: number;
  tokensSalida: number;
  tokensCache: number;
  /** Millonésimas de dólar, entero. */
  costoMicrousd: number;
  rondas: number;
  duracionMs: number;
  resultado: 'ok' | 'cortado' | 'error';
};

/** Solo se inserta: `core.uso` es inmutable. */
export async function registrarUso(tx: Transaccion, u: UsoParaGuardar): Promise<void> {
  await tx.insert(uso).values({ tenantId: TENANT, usuarioId: USUARIO, ...u });
}

/** La zona horaria de la empresa (por defecto Lima). */
export async function zonaDeLaEmpresa(tx: Transaccion): Promise<string> {
  const filas = await tx.execute<{ zona: string }>(sql`select zona_horaria as zona from core.empresa_config where tenant_id = current_setting('app.tenant_id', true)`);
  return filas.rows[0]?.zona ?? 'America/Lima';
}

/** Lo gastado por TODA la empresa en el mes en curso, contado en la zona horaria de la empresa (el 1.° a las 00:00 de allí). */
export async function gastoDelMes(tx: Transaccion, ahora: Date, zona: string): Promise<number> {
  const [r] = await tx
    .select({ total: sql<string>`coalesce(sum(${uso.costoMicrousd}), 0)::text` })
    .from(uso)
    .where(and(eq(uso.tenantId, TENANT), sql`${uso.creadoEn} >= date_trunc('month', ${ahora.toISOString()}::timestamptz at time zone ${zona}) at time zone ${zona}`));
  return Number(r?.total ?? 0);
}

/**
 * Turnos de ESTA persona en los últimos `segundos`: los que ya terminaron (están en `core.uso`, que no se puede borrar ni
 * cambiar) más los que siguen en curso, que todavía no dejaron su fila de uso. Borrar la conversación no baja la cuenta.
 */
export async function turnosRecientes(tx: Transaccion, segundos: number): Promise<number> {
  const ventana = sql`now() - make_interval(secs => ${segundos})`;
  const [terminados] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(uso)
    .where(and(eq(uso.tenantId, TENANT), eq(uso.usuarioId, USUARIO), eq(uso.origen, 'agente'), sql`${uso.creadoEn} > ${ventana}`));
  const [enCurso] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(agenteMensajes)
    .where(and(eq(agenteMensajes.tenantId, TENANT), eq(agenteMensajes.usuarioId, USUARIO), eq(agenteMensajes.rol, 'agente'), eq(agenteMensajes.estado, 'en_curso'), sql`${agenteMensajes.actualizadoEn} > ${ventana}`));
  return (terminados?.n ?? 0) + (enCurso?.n ?? 0);
}

export type ConfiguracionGuardada = typeof agenteConfiguracion.$inferSelect;

/** La fila de la empresa, o `null` si nunca eligió nada (rigen los valores del despliegue). */
export async function leerConfiguracion(tx: Transaccion): Promise<ConfiguracionGuardada | null> {
  const [fila] = await tx.select().from(agenteConfiguracion).where(eq(agenteConfiguracion.tenantId, TENANT));
  return fila ?? null;
}
