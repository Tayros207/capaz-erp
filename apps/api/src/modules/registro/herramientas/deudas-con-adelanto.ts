import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarAbono, validarVencimiento } from '../domain/deuda.js';
import { fechaDeMovimiento } from '../domain/movimiento.js';
import { asegurarCatalogos } from '../repositories/catalogos.repository.js';
import { existeSucursal } from '../repositories/cuentas.repository.js';
import { verDeuda } from '../repositories/deudas.repository.js';
import { existeContacto } from '../repositories/movimientos.repository.js';
import { ID_DE_EJEMPLO, MODULO, rechazoDe } from './comun.js';
import { conflictoDeOrigen, crearDeudaYEmitir, registrarAbono } from './deudas-comun.js';
import { resolverCuenta } from './guardar-movimiento.js';
import { aDeudaDto, aMovimientoDto, codigoDeLaDeuda } from './mapeo.js';

// Anotar una deuda que nace con un adelanto: la deuda y el movimiento del adelanto, en una sola operación. Mueve dinero.

export const deudaCrearConAdelanto = definirHerramienta('deuda_crear_con_adelanto', {
  modulo: MODULO,
  permiso: 'registro:editar',
  criticidad: 'normal',
  idempotente: true,
  mueveDinero: true,
  ayuda: {
    titulo: 'Anotar una deuda con adelanto',
    paraQueSirve: 'Registra una deuda y, en el mismo paso, el adelanto que ya se cobró o se pagó. Deja la deuda parcial con su saldo y el movimiento de dinero del adelanto.',
    cuandoUsarla: 'Cuando cierras un trabajo por un total y recibes (o das) una parte por adelantado.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'por_cobrar o por_pagar.', ejemplo: 'por_cobrar' },
      { nombre: 'contactoId', queSeAnota: 'Cliente o proveedor.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'concepto', queSeAnota: 'Por qué se debe.', ejemplo: 'Contrato de volantes' },
      { nombre: 'totalCentimos', queSeAnota: 'Total en céntimos, mayor que cero.', ejemplo: '24000' },
      { nombre: 'adelantoCentimos', queSeAnota: 'Adelanto en céntimos; menor que el total.', ejemplo: '10000' },
      { nombre: 'cuentaId', queSeAnota: 'Cuenta donde entra o de donde sale el adelanto (opcional: la principal).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'medioDePago', queSeAnota: 'efectivo, transferencia, yape, plin, tarjeta u otro.', ejemplo: 'yape' },
    ],
    ejemploTecleado: 'contrato 240 con adelanto de 100, cliente Cristina Neira',
    ejemploHablado: 'contrato de doscientos cuarenta soles con cien de adelanto para Cristina Neira',
    erroresComunes: ['El adelanto debe ser menor que el total.', 'El contacto no existe.', 'La fecha no puede ser futura.'],
    relacionadas: ['deuda_crear', 'deuda_abonar'],
  },
  auditar: (_a, d) => ({
    entidadTipo: 'deuda',
    entidadId: d?.deuda.id,
    resumen: d
      ? { codigo: d.deuda.codigo, movimiento: d.movimiento.codigo, totalCentimos: d.deuda.totalCentimos, adelantoCentimos: d.movimiento.montoCentimos, estado: d.deuda.estado }
      : undefined,
  }),
  async ejecutar(args, ctx, tx) {
    await asegurarCatalogos(tx, ctx);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const vence = validarVencimiento(fecha, args.venceEn);
    if (!vence.ok) return rechazoDe(vence);
    const fechaAdelanto = fechaDeMovimiento(args.fecha, hoy.dia);
    if (!fechaAdelanto.ok) return rechazoDe(fechaAdelanto);
    if (!(await existeContacto(tx, ctx, args.contactoId))) return rechazo('no_encontrado', 'No existe ese contacto.');
    if (args.sucursalId && !(await existeSucursal(tx, ctx, args.sucursalId))) return rechazo('no_encontrado', 'No existe esa sucursal.');
    const cuenta = await resolverCuenta(tx, ctx, args.cuentaId);
    if (!cuenta.ok) return cuenta;

    const creada = await crearDeudaYEmitir(tx, ctx, hoy, {
      tipo: args.tipo,
      contactoId: args.contactoId,
      concepto: args.concepto,
      totalCentimos: args.totalCentimos,
      fecha,
      venceEn: args.venceEn ?? null,
      sucursalId: args.sucursalId ?? null,
      notas: args.notas || null,
      origenTipo: args.origenTipo ?? null,
      origenId: args.origenId ?? null,
    });
    if (!creada) return conflictoDeOrigen();
    const deuda = await verDeuda(tx, ctx, creada.id, null);
    if (!deuda) throw new Error('La deuda recién guardada no se pudo leer.');
    const abono = aplicarAbono({ estado: 'pendiente', totalCentimos: args.totalCentimos, abonadoCentimos: 0 }, args.adelantoCentimos);
    if (!abono.ok) return rechazoDe(abono);
    const r = await registrarAbono(tx, ctx, {
      anio: hoy.anio,
      deuda,
      abono,
      montoCentimos: args.adelantoCentimos,
      fecha: fechaAdelanto.fecha,
      cuenta: cuenta.cuenta,
      medioDePago: args.medioDePago,
      descripcion: `Adelanto de ${codigoDeLaDeuda(deuda)}`,
      origen: args.origen,
    });
    const final = await verDeuda(tx, ctx, creada.id, null);
    if (!final) throw new Error('La deuda con adelanto no se pudo leer.');
    return exito({ deuda: aDeudaDto(final, hoy.dia), movimiento: aMovimientoDto(r.movimiento) }, { avisos: r.avisos });
  },
});
