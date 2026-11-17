import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarAbono, type EstadoDeDeuda } from '../domain/deuda.js';
import { fechaDeMovimiento } from '../domain/movimiento.js';
import { asegurarCatalogos } from '../repositories/catalogos.repository.js';
import { bloquearDeuda, verDeuda } from '../repositories/deudas.repository.js';
import { ID_DE_EJEMPLO, MODULO, propietarioDe, rechazoDe } from './comun.js';
import { registrarAbono } from './deudas-comun.js';
import { resolverCuenta } from './guardar-movimiento.js';
import { aDeudaDto, aMovimientoDto, codigoDeLaDeuda } from './mapeo.js';

// Abonar una deuda: el único camino por el que una deuda cambia de saldo. Mueve dinero.

export const deudaAbonar = definirHerramienta('deuda_abonar', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  mueveDinero: true,
  ayuda: {
    titulo: 'Registrar un abono',
    paraQueSirve: 'Anota un cobro (deuda por cobrar) o un pago (deuda por pagar), total o parcial. Crea el movimiento de dinero y baja el saldo de la deuda.',
    cuandoUsarla: 'Cada vez que te pagan una parte de lo que te deben o pagas una parte de lo que debes.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la deuda.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'montoCentimos', queSeAnota: 'Monto del abono en céntimos; no puede superar el saldo.', ejemplo: '10000' },
      { nombre: 'fecha', queSeAnota: 'Día del abono (AAAA-MM-DD); no puede ser futuro.', ejemplo: '2026-03-12' },
      { nombre: 'cuentaId', queSeAnota: 'Cuenta donde entra o de donde sale (opcional: la principal).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'medioDePago', queSeAnota: 'efectivo, transferencia, yape, plin, tarjeta u otro.', ejemplo: 'transferencia' },
      { nombre: 'origen', queSeAnota: 'Cómo se anotó: teclado (por defecto) o voz.', ejemplo: 'voz' },
    ],
    ejemploTecleado: 'José Pérez abonó 100 a la deuda CXC-2026-0007 por transferencia',
    ejemploHablado: 'José Pérez me pagó cien soles de lo que me debe, por transferencia',
    erroresComunes: ['El abono supera el saldo pendiente.', 'La deuda ya está pagada o anulada.', 'La fecha no puede ser futura.'],
    relacionadas: ['deuda_ver', 'deudas_listar', 'movimiento_anular'],
  },
  auditar: (a, d) => ({
    entidadTipo: 'deuda',
    entidadId: a.id,
    resumen: d ? { codigo: d.deuda.codigo, movimiento: d.movimiento.codigo, montoCentimos: d.movimiento.montoCentimos, estado: d.deuda.estado } : undefined,
  }),
  async ejecutar(args, ctx, tx) {
    await asegurarCatalogos(tx, ctx);
    // Primero el bloqueo, después el saldo: dos abonos a la vez se turnan y el segundo ve lo que dejó el primero.
    const deuda = await bloquearDeuda(tx, ctx, args.id, propietarioDe(ctx));
    if (!deuda) return rechazo('no_encontrado', 'No existe esa deuda.');
    const abono = aplicarAbono({ estado: deuda.estado as EstadoDeDeuda, totalCentimos: deuda.totalCentimos, abonadoCentimos: deuda.abonadoCentimos }, args.montoCentimos);
    if (!abono.ok) return rechazoDe(abono);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = fechaDeMovimiento(args.fecha, hoy.dia);
    if (!fecha.ok) return rechazoDe(fecha);
    const cuenta = await resolverCuenta(tx, ctx, args.cuentaId);
    if (!cuenta.ok) return cuenta;
    const codigo = codigoDeLaDeuda(deuda);
    const r = await registrarAbono(tx, ctx, {
      anio: hoy.anio,
      deuda,
      abono,
      montoCentimos: args.montoCentimos,
      fecha: fecha.fecha,
      cuenta: cuenta.cuenta,
      medioDePago: args.medioDePago,
      descripcion: args.descripcion || `Abono de ${codigo}`,
      origen: args.origen,
    });
    const final = await verDeuda(tx, ctx, deuda.id, null);
    if (!final) throw new Error('La deuda abonada no se pudo leer.');
    return exito({ deuda: aDeudaDto(final, hoy.dia), movimiento: aMovimientoDto(r.movimiento) }, { avisos: r.avisos });
  },
});
