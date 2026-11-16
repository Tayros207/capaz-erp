import { rechazo, type Aviso, type ErrorDeRespuesta } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { emitir } from '../../../core/eventos/emisor.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { CLAVE_DE_MOVIMIENTO, codigoDeMovimiento } from '../domain/codigos.js';
import { avisoDeSaldoNegativo, cuentaUtilizable, saldoDeCuenta } from '../domain/movimiento.js';
import { cuentaPrincipal, flujosPorCuenta, SIN_FLUJO, verCuenta, type Cuenta } from '../repositories/cuentas.repository.js';
import { insertarMovimiento, verMovimiento, type DatosDeMovimiento, type MovimientoConNombres } from '../repositories/movimientos.repository.js';
import { rechazoDe } from './comun.js';

// Lo que comparten `movimiento_registrar` y `deuda_abonar`: elegir la cuenta, numerar, guardar, avisar del saldo
// negativo y emitir `movimiento.registrado`. Todo dentro de la transacción del ejecutor.

type Rechazo = { ok: false; error: ErrorDeRespuesta };

/** La cuenta indicada o, si no llega, la principal. Una cuenta archivada es conflicto. */
export async function resolverCuenta(tx: Transaccion, ctx: ContextoDeEmpresa, cuentaId: string | undefined): Promise<{ ok: true; cuenta: Cuenta } | Rechazo> {
  const cuenta = cuentaId ? await verCuenta(tx, ctx, cuentaId) : await cuentaPrincipal(tx, ctx);
  if (!cuenta) {
    return cuentaId
      ? rechazo('no_encontrado', 'No existe esa cuenta.')
      : rechazo('conflicto', 'No hay una cuenta principal: marca una en «Cuentas y categorías».');
  }
  const regla = cuentaUtilizable(cuenta);
  return regla.ok ? { ok: true, cuenta } : rechazoDe(regla);
}

/**
 * Numera con el correlativo del año de la empresa (sin huecos: si la transacción se revierte, el número vuelve),
 * guarda el movimiento, calcula el saldo en que queda la cuenta y emite el evento.
 */
export async function guardarMovimiento(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  anio: number,
  cuenta: Cuenta,
  datos: Omit<DatosDeMovimiento, 'numero' | 'anio' | 'cuentaId'>,
): Promise<{ movimiento: MovimientoConNombres; avisos: Aviso[] }> {
  const numero = await siguienteNumero(tx, CLAVE_DE_MOVIMIENTO, { anio });
  const id = await insertarMovimiento(tx, ctx, { ...datos, numero, anio, cuentaId: cuenta.id });
  const movimiento = await verMovimiento(tx, ctx, id, null);
  if (!movimiento) throw new Error('El movimiento recién guardado no se pudo leer.');
  const flujo = (await flujosPorCuenta(tx, ctx, { cuentaId: cuenta.id })).get(cuenta.id) ?? SIN_FLUJO;
  const aviso = avisoDeSaldoNegativo(datos.tipo, cuenta.nombre, saldoDeCuenta(cuenta.saldoInicialCentimos, flujo.ingresos, flujo.egresos));
  await emitir(tx, 'movimiento.registrado', {
    id,
    codigo: codigoDeMovimiento(anio, numero),
    tipo: datos.tipo,
    montoCentimos: datos.montoCentimos,
    fecha: datos.fecha,
    cuentaId: cuenta.id,
    contactoId: datos.contactoId,
    deudaId: datos.deudaId,
  });
  return { movimiento, avisos: aviso ? [aviso] : [] };
}
