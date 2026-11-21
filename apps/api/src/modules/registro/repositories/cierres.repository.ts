import { and, count, desc, eq, gte, lte, sql, type SQL } from 'drizzle-orm';
import { sumarDias, type MovimientoDeSemanaDto, type SaldoDeCierreDto } from '@capaz/shared';
import { clientes } from '../../../db/esquema/core-maestros.js';
import { registroCierres, registroCuentas, registroMovimientos } from '../../../db/esquema/registro.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { codigoDeMovimiento } from '../domain/codigos.js';
import { saldoDeCuenta } from '../domain/movimiento.js';
import { LIKE_DE_CIERRE } from '../domain/cierre.js';
import { LIKE_DE_TRANSFERENCIA } from '../domain/transferencia.js';
import { flujosPorCuenta, SIN_FLUJO, type Cuenta } from './cuentas.repository.js';

// Repositorio del cierre semanal. El cierre no se edita ni se borra (la base lo impide).

export type Cierre = typeof registroCierres.$inferSelect;
export type FiltroDeSemana = 'todos' | 'ingresos_sin_cliente' | 'cobros_en_cuenta_dudosa';
export type CifrasDeCuenta = {
  cuenta: Cuenta;
  saldoInicialCentimos: number;
  ingresosCentimos: number;
  egresosCentimos: number;
  transferenciasNetasCentimos: number;
  sistemaCentimos: number;
  /** Neto (ingresos menos egresos) de lo que tiene fecha después del sábado y hasta hoy; 0 si la semana aún no termina. */
  movimientosPosterioresCentimos: number;
  movimientos: number;
};

const m = registroMovimientos;

export async function cierreDeSemana(tx: Transaccion, ctx: ContextoDeEmpresa, desde: string): Promise<Cierre | null> {
  const [fila] = await tx.select().from(registroCierres).where(and(eq(registroCierres.tenantId, ctx.empresaId), eq(registroCierres.desde, desde)));
  return fila ?? null;
}

/** `null` si otra persona ya cerró esa semana (la restricción única la frenó). */
export async function insertarCierre(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  datos: { desde: string; hasta: string; saldos: SaldoDeCierreDto[]; notas: string | null },
): Promise<Cierre | null> {
  const [fila] = await tx
    .insert(registroCierres)
    .values({ ...datos, tenantId: ctx.empresaId, cerradoPor: ctx.usuarioId })
    .onConflictDoNothing()
    .returning();
  return fila ?? null;
}

/**
 * Cifras de cada cuenta en la semana: saldo al empezar el domingo anterior y saldo con todo lo que tiene fecha hasta el
 * sábado. Son dos llamadas a `flujosPorCuenta(antesDe)`; con `hoy` (posterior al sábado) hay una tercera para saber cuánto
 * se movió después del sábado y hasta hoy.
 */
export async function cifrasDeCuentas(tx: Transaccion, ctx: ContextoDeEmpresa, cuentas: Cuenta[], desde: string, hasta: string, hoy?: string): Promise<CifrasDeCuenta[]> {
  const antes = await flujosPorCuenta(tx, ctx, { antesDe: sumarDias(desde, -1) });
  const despues = await flujosPorCuenta(tx, ctx, { antesDe: sumarDias(hasta, 1) });
  const conHoy = hoy !== undefined && hoy > hasta ? await flujosPorCuenta(tx, ctx, { antesDe: sumarDias(hoy, 1) }) : despues;
  return cuentas.map((cuenta) => {
    const a = antes.get(cuenta.id) ?? SIN_FLUJO;
    const d = despues.get(cuenta.id) ?? SIN_FLUJO;
    const h = conHoy.get(cuenta.id) ?? SIN_FLUJO;
    return {
      cuenta,
      saldoInicialCentimos: saldoDeCuenta(cuenta.saldoInicialCentimos, a.ingresos, a.egresos),
      ingresosCentimos: d.ingresos - a.ingresos,
      egresosCentimos: d.egresos - a.egresos,
      transferenciasNetasCentimos: d.entradasPorTransferencia - a.entradasPorTransferencia - (d.salidasPorTransferencia - a.salidasPorTransferencia),
      sistemaCentimos: saldoDeCuenta(cuenta.saldoInicialCentimos, d.ingresos, d.egresos),
      movimientosPosterioresCentimos: saldoDeCuenta(0, h.ingresos - d.ingresos, h.egresos - d.egresos),
      movimientos: d.movimientos - a.movimientos,
    };
  });
}

/** Diferencia de caja creada por el cierre: la crea el sistema (`origen = 'modulo'`) con el prefijo `cierre:`. */
export const esDiferenciaDeCierre = sql`(${m.origen} = 'modulo' and ${m.origenRef} like ${LIKE_DE_CIERRE})`;

const sinTransferenciaNiCierre = sql`(${m.origenRef} is null or (${m.origenRef} not like ${LIKE_DE_TRANSFERENCIA} and not ${esDiferenciaDeCierre}))`;

function condicionDe(filtro: FiltroDeSemana): SQL | undefined {
  const c = registroCuentas;
  if (filtro === 'ingresos_sin_cliente') return and(eq(m.tipo, 'ingreso'), sql`${m.contactoId} is null`, sinTransferenciaNiCierre);
  if (filtro === 'cobros_en_cuenta_dudosa') {
    const digital = sql`${m.medioDePago} in ('yape', 'plin', 'transferencia', 'tarjeta')`;
    return and(
      eq(m.tipo, 'ingreso'),
      sinTransferenciaNiCierre,
      sql`((${digital} and ${c.tipo} = 'caja') or (${m.medioDePago} = 'efectivo' and ${c.tipo} in ('banco', 'billetera')))`,
    );
  }
  return undefined;
}

/** Movimientos activos entre el domingo anterior y el sábado, del más reciente al más antiguo, con su total. */
export async function movimientosDeSemana(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  desde: string,
  hasta: string,
  filtro: FiltroDeSemana,
  limite: number,
): Promise<{ items: MovimientoDeSemanaDto[]; total: number }> {
  const c = registroCuentas;
  const donde = and(eq(m.tenantId, ctx.empresaId), eq(m.estado, 'activo'), gte(m.fecha, desde), lte(m.fecha, hasta), condicionDe(filtro));
  const base = tx
    .select({
      id: m.id,
      anio: m.anio,
      numero: m.numero,
      fecha: m.fecha,
      tipo: m.tipo,
      montoCentimos: m.montoCentimos,
      cuentaNombre: c.nombre,
      contactoNombre: clientes.nombre,
      descripcion: m.descripcion,
      medioDePago: m.medioDePago,
    })
    .from(m)
    .innerJoin(c, and(eq(c.tenantId, m.tenantId), eq(c.id, m.cuentaId)))
    .leftJoin(clientes, and(eq(clientes.tenantId, m.tenantId), eq(clientes.id, m.contactoId)))
    .where(donde)
    .orderBy(desc(m.fecha), desc(m.id))
    .limit(limite);
  const [filas, [total]] = await Promise.all([
    base,
    tx.select({ n: count() }).from(m).innerJoin(c, and(eq(c.tenantId, m.tenantId), eq(c.id, m.cuentaId))).where(donde),
  ]);
  return {
    items: filas.map((f) => ({
      id: f.id,
      codigo: codigoDeMovimiento(f.anio, f.numero),
      fecha: f.fecha,
      tipo: f.tipo as 'ingreso' | 'egreso',
      montoCentimos: f.montoCentimos,
      cuentaNombre: f.cuentaNombre,
      contactoNombre: f.contactoNombre,
      descripcion: f.descripcion,
      medioDePago: f.medioDePago,
    })),
    total: total?.n ?? 0,
  };
}
