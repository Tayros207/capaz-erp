import { exito, formatearSoles, rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import type { TipoDeDeuda } from '../domain/codigos.js';
import { puedeRestaurarse, puedeRestaurarseElAbono, raizDeFamilia } from '../domain/correccion.js';
import type { DespuesDeAbonar, EstadoDeDeuda } from '../domain/deuda.js';
import { cuentaUtilizable } from '../domain/movimiento.js';
import { verCuenta } from '../repositories/cuentas.repository.js';
import { bloquearDeuda, guardarAbonado, verDeuda } from '../repositories/deudas.repository.js';
import { bloquearFamiliaDeCorreccion, restaurarMovimiento, verMovimiento, vigenteDeFamilia, type MovimientoConNombres } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { aMovimientoDto, codigoDe, codigoDeLaDeuda } from './mapeo.js';
import { conLineas } from './movimientos-lineas.js';

// Restaurar (sacar de la papelera) un movimiento anulado. La base solo deja cambiar las columnas de anulación: el
// movimiento vuelve a activo tal como estaba. Corregir y restaurar toman la cadena de correcciones en el mismo orden.

const NO_EXISTE = 'No existe ese movimiento.';

type Rechazo = { ok: false; error: ErrorDeRespuesta };
type DeudaDelAbono = { id: string; tipo: string; contactoId: string; numero: number; anio: number; estado: string; totalCentimos: number; abonadoCentimos: number };
type Preparada = { ok: true; previo: MovimientoConNombres; deuda: DeudaDelAbono | null; abono: ({ ok: true } & DespuesDeAbonar) | null };

async function prepararRestauracion(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, bloquear: boolean): Promise<Rechazo | Preparada> {
  const propietario = propietarioDe(ctx);
  let previo = await verMovimiento(tx, ctx, id, propietario);
  if (!previo) return rechazo('no_encontrado', NO_EXISTE);
  // Con alcance «propios» solo restaura quien lo anuló: así nadie deshace una anulación ajena.
  if (propietario !== null && previo.anuladoPor !== ctx.usuarioId) return rechazo('sin_permiso', 'Solo puede restaurarlo quien lo anuló.');
  // Mismo orden que al anular y al abonar: primero la deuda, después la cadena de correcciones.
  const deuda = previo.deudaId ? (bloquear ? await bloquearDeuda(tx, ctx, previo.deudaId, null) : await verDeuda(tx, ctx, previo.deudaId, null)) : null;
  if (previo.deudaId && !deuda) throw new Error('El abono apunta a una deuda que no existe.');
  const raiz = raizDeFamilia(previo);
  if (bloquear) {
    await bloquearFamiliaDeCorreccion(tx, ctx, raiz);
    previo = await verMovimiento(tx, ctx, id, propietario);
    if (!previo) return rechazo('no_encontrado', NO_EXISTE);
  }
  // Se lee después de bloquear, en una sentencia nueva: así se ve un reemplazo que otra transacción acaba de guardar.
  const vigente = await vigenteDeFamilia(tx, ctx, raiz);
  const regla = puedeRestaurarse(previo, vigente ? { codigo: codigoDe(vigente) } : null);
  if (!regla.ok) return rechazoDe(regla);
  const cuenta = await verCuenta(tx, ctx, previo.cuentaId);
  if (!cuenta) return rechazo('no_encontrado', 'No existe la cuenta de ese movimiento.');
  const cuentaOk = cuentaUtilizable(cuenta);
  if (!cuentaOk.ok) return rechazoDe(cuentaOk);
  if (!deuda) return { ok: true, previo, deuda: null, abono: null };
  const abono = puedeRestaurarseElAbono({ estado: deuda.estado as EstadoDeDeuda, totalCentimos: deuda.totalCentimos, abonadoCentimos: deuda.abonadoCentimos }, previo.montoCentimos);
  if (!abono.ok) return rechazoDe(abono);
  return { ok: true, previo, deuda, abono };
}

export const movimientoRestaurar = definirHerramienta('movimiento_restaurar', {
  modulo: MODULO,
  permiso: 'registro:anular',
  criticidad: 'critica',
  mueveDinero: true,
  ayuda: {
    titulo: 'Restaurar un movimiento anulado',
    paraQueSirve: 'Saca de la papelera un ingreso o egreso anulado y lo deja activo otra vez, tal como estaba. Si era el abono de una deuda, el monto vuelve a descontarse de su saldo.',
    cuandoUsarla: 'Cuando anulaste un movimiento por error. No sirve para transferencias, ni si ya existe una versión corregida vigente, ni si el abono ya no cabe en el saldo de la deuda.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del movimiento anulado.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'restaurar el movimiento MOV-2026-000123',
    ejemploHablado: 'restaura el movimiento ciento veintitrés, lo anulé sin querer',
    erroresComunes: [
      'Ese movimiento no está anulado.',
      'Ya hay una versión vigente (corregida): anula primero esa versión.',
      'El abono ya no cabe en el saldo de la deuda, o la deuda está anulada o pagada.',
      'La cuenta del movimiento está archivada.',
    ],
    relacionadas: ['movimiento_anular', 'movimiento_corregir', 'movimientos_listar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'movimiento', entidadId: a.id, resumen: d ? { codigo: d.codigo, estado: d.estado, eraAbono: d.deudaId !== null } : undefined }),
  async resumir(args, ctx, tx) {
    const p = await prepararRestauracion(tx, ctx, args.id, false);
    if (!p.ok) return { ok: false, error: p.error };
    let resumen = `Restaurarás el ${p.previo.tipo} ${codigoDe(p.previo)} de ${formatearSoles(p.previo.montoCentimos)}.`;
    if (p.deuda && p.abono) resumen += ` La deuda ${codigoDeLaDeuda({ ...p.deuda, tipo: p.deuda.tipo })} quedará con ${formatearSoles(p.abono.saldoCentimos)} de saldo.`;
    return { ok: true, resumen: { resumen, huella: hashCanonico({ estado: p.previo.estado, deudaId: p.previo.deudaId, abonado: p.deuda?.abonadoCentimos ?? null, estadoDeuda: p.deuda?.estado ?? null }) } };
  },
  async ejecutar(args, ctx, tx) {
    const p = await prepararRestauracion(tx, ctx, args.id, true);
    if (!p.ok) return p;
    const m = p.previo;
    if (!(await restaurarMovimiento(tx, ctx, m.id))) return rechazo('conflicto', 'Ese movimiento no está anulado.');
    if (p.deuda && p.abono) {
      await guardarAbonado(tx, ctx, p.deuda.id, p.abono.abonadoCentimos, p.abono.estado);
      if (p.abono.quedaPagada) {
        await emitir(tx, 'deuda.pagada', { id: p.deuda.id, codigo: codigoDeLaDeuda(p.deuda), tipo: p.deuda.tipo as TipoDeDeuda, contactoId: p.deuda.contactoId, totalCentimos: p.deuda.totalCentimos });
      }
    }
    await emitir(tx, 'movimiento.restaurado', {
      id: m.id,
      codigo: codigoDe(m),
      tipo: m.tipo as 'ingreso' | 'egreso',
      montoCentimos: m.montoCentimos,
      fecha: m.fecha,
      cuentaId: m.cuentaId,
      contactoId: m.contactoId,
      deudaId: m.deudaId,
    });
    const final = await verMovimiento(tx, ctx, m.id, null);
    if (!final) throw new Error('El movimiento restaurado no se pudo leer.');
    return exito((await conLineas(tx, ctx, [aMovimientoDto(final)]))[0]!);
  },
});
