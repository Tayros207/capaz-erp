import { exito, formatearSoles, rechazo } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import type { ResultadoDeResumen } from '../../../core/herramientas/tipos.js';
import type { ContextoDeEmpresa, Transaccion } from '../../../infra/database/con-empresa.js';
import { referenciaDeTransferencia } from '../domain/transferencia.js';
import { anularMovimiento, bloquearPatasDeTransferencia, patasDeTransferencia, verMovimiento, type MovimientoConNombres } from '../repositories/movimientos.repository.js';
import { aMovimientoDto, codigoDe } from './mapeo.js';

// Anular una pata de una transferencia anula las dos juntas: nunca queda una sola pata viva (el dinero no
// aparecería ni desaparecería de una cuenta). La usa `movimiento_anular`.

const YA_ANULADA = 'Esa transferencia ya está anulada.';

/** Texto y huella de la confirmación al anular una pata: describe la transferencia entera. */
export async function resumirAnulacionDeTransferencia(tx: Transaccion, ctx: ContextoDeEmpresa, transferenciaId: string): Promise<ResultadoDeResumen> {
  const patas = await patasDeTransferencia(tx, ctx, referenciaDeTransferencia(transferenciaId));
  const salida = patas.find((p) => p.tipo === 'egreso');
  const entrada = patas.find((p) => p.tipo === 'ingreso');
  if (!salida || !entrada) throw new Error('La transferencia no tiene sus dos movimientos.');
  if (patas.some((p) => p.estado !== 'activo')) return { ok: false, error: { codigo: 'conflicto', mensaje: YA_ANULADA } };
  const resumen =
    `Anularás la transferencia de ${formatearSoles(salida.montoCentimos)} de «${salida.cuentaNombre}» a «${entrada.cuentaNombre}»: ` +
    `se anulan sus dos movimientos (${codigoDe(salida)} y ${codigoDe(entrada)}) y cada cuenta recupera su saldo anterior.`;
  return { ok: true, resumen: { resumen, huella: hashCanonico({ transferenciaId, estados: patas.map((p) => p.estado) }) } };
}

/** Anula las dos patas en la misma transacción y devuelve la que se pidió. `pedido` ya pasó por el alcance «propios». */
export async function anularTransferencia(tx: Transaccion, ctx: ContextoDeEmpresa, pedido: MovimientoConNombres, transferenciaId: string, motivo: string) {
  const patas = await bloquearPatasDeTransferencia(tx, ctx, referenciaDeTransferencia(transferenciaId));
  if (patas.length !== 2) throw new Error('La transferencia no tiene sus dos movimientos.');
  if (patas.some((p) => p.estado !== 'activo')) return rechazo('conflicto', YA_ANULADA);
  for (const pata of patas) {
    if (!(await anularMovimiento(tx, ctx, pata.id, motivo))) return rechazo('conflicto', YA_ANULADA);
    await emitir(tx, 'movimiento.anulado', { id: pata.id, codigo: codigoDe(pata), deudaId: null });
  }
  const final = await verMovimiento(tx, ctx, pedido.id, null);
  if (!final) throw new Error('El movimiento anulado no se pudo leer.');
  return exito(aMovimientoDto(final));
}
