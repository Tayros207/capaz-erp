import { importe, rechazo, totalDeLineas, type LineaDeOrdenEntrada } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import {
  CLAVE_DE_CORRELATIVO,
  codigoDeOrden,
  comprobarAnulacion,
  comprobarCambioDeEstado,
  comprobarFechas,
  comprobarMontos,
  resumenDeLineas,
  saldoDe,
  sePuedeAnular,
  sePuedeEditar,
  totalTrasRetener,
} from '../domain/orden.js';
import { actualizarOrden, agregarEvento, clienteVigente, crearOrden, reemplazarItems, verOrden, type LineaPreparada } from '../repositories/ordenes.repository.js';
import { ID, MODULO, NO_EXISTE, auditarOrden, responderOrden } from './comunes.js';

// Alta, edición, cambio de estado, cobro y anulación de órdenes de trabajo (reglas de SF). Cada paso deja su fila en el
// historial y, cuando corresponde, su evento en la misma transacción: Finanzas lo consume para PROPONER la deuda con su
// adelanto, el cobro del saldo o la anulación (nunca mueve dinero por su cuenta).

const CLIENTE_NO_VIGENTE = 'El cliente no existe o está archivado.';

/** Cada línea con su unidad y su subtotal redondeado al céntimo; el total es la suma de los subtotales. */
const preparar = (lineas: readonly LineaDeOrdenEntrada[]): { lineas: LineaPreparada[]; totalCentimos: number } => ({
  lineas: lineas.map((l) => ({ ...l, descripcion: l.descripcion.trim(), unidad: l.unidad?.trim() || 'unidad', subtotalCentimos: importe(l.cantidadMilesimas, l.precioUnitarioMilesimas) })),
  totalCentimos: totalDeLineas(lineas),
});

const LINEAS = {
  nombre: 'lineas',
  queSeAnota: 'Los trabajos: por línea, descripción, cantidad y valor unitario en milésimas, y opcionalmente material, medida, colores y acabado.',
  ejemplo: '[{ "descripcion": "Mil volantes", "cantidadMilesimas": 1000000, "precioUnitarioMilesimas": 240, "material": "couché 150g", "medida": "A5", "colores": "full color", "acabado": "plastificado" }]',
};

export const ordenCrear = definirHerramienta('produccion_orden_crear', {
  modulo: MODULO,
  permiso: 'produccion:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear una orden de trabajo',
    paraQueSirve: 'Anota el trabajo de un cliente con su cantidad, su valor, el adelanto que dejó a cuenta y lo que falta cancelar. Recibe su número, entra en la cola del taller y Finanzas propone anotar la venta con su adelanto.',
    cuandoUsarla: 'Cuando un cliente encarga un trabajo de imprenta o taller.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'El cliente del trabajo.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      LINEAS,
      { nombre: 'adelantoCentimos', queSeAnota: 'Lo que dejó a cuenta, en céntimos (por defecto, 0; puede ser todo el total). Falta cancelar = total − adelanto.', ejemplo: '10000' },
      { nombre: 'entregaEl', queSeAnota: 'Para cuándo lo necesita (opcional).', ejemplo: '2026-03-20' },
      { nombre: 'notas', queSeAnota: 'Nota para el taller (opcional).', ejemplo: 'El cliente pasa a recoger el sábado temprano' },
    ],
    ejemploTecleado: 'orden para Cristina: un millar de volantes a 240 soles, adelanto 100, para el viernes',
    ejemploHablado: 'anota para Cristina un millar de volantes por doscientos cuarenta soles con cien de adelanto, para el viernes',
    erroresComunes: ['La orden necesita al menos una línea.', 'El adelanto no puede superar el total del trabajo.', 'La entrega no puede ser anterior a la fecha de la orden.'],
    relacionadas: ['produccion_orden_estado', 'produccion_orden_cobrar', 'deuda_crear_con_adelanto'],
  },
  auditar: auditarOrden,
  async ejecutar(args, ctx, tx) {
    if (!(await clienteVigente(tx, ctx, args.clienteId))) return rechazo('argumentos_invalidos', CLIENTE_NO_VIGENTE);
    const { lineas, totalCentimos } = preparar(args.lineas);
    const montos = comprobarMontos({ totalCentimos, adelantoCentimos: args.adelantoCentimos });
    if (!montos.ok) return rechazo('argumentos_invalidos', montos.motivo);
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    const fechas = comprobarFechas(fecha, args.entregaEl ?? null);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const numero = await siguienteNumero(tx, CLAVE_DE_CORRELATIVO, { anio: hoy.anio });
    const id = await crearOrden(tx, ctx, { numero, anio: hoy.anio, fecha, entregaEl: args.entregaEl ?? null, clienteId: args.clienteId, totalCentimos, adelantoCentimos: args.adelantoCentimos, notas: args.notas?.trim() || null });
    await reemplazarItems(tx, ctx, id, lineas);
    await agregarEvento(tx, ctx, { ordenId: id, tipo: 'creada', estadoAnterior: null, estadoNuevo: 'pendiente', nota: null });
    await emitir(tx, 'produccion.orden_creada', {
      id,
      codigo: codigoDeOrden(hoy.anio, numero),
      clienteId: args.clienteId,
      descripcion: resumenDeLineas(lineas.map((l) => l.descripcion)),
      totalCentimos,
      adelantoCentimos: args.adelantoCentimos,
      entregaEl: args.entregaEl ?? null,
    });
    return responderOrden(tx, ctx, id);
  },
});

export const ordenEditar = definirHerramienta('produccion_orden_editar', {
  modulo: MODULO,
  permiso: 'produccion:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Corregir una orden de trabajo',
    paraQueSirve: 'Cambia el cliente, las líneas, el adelanto, la entrega o la nota. Si envías líneas, reemplazan a todas las anteriores y el total se recalcula. Sirve en cualquier estado menos entregada.',
    cuandoUsarla: 'Cuando el cliente ajusta la cantidad, el precio o la fecha, o hubo un error al anotar.',
    campos: [ID, LINEAS, { nombre: 'adelantoCentimos', queSeAnota: 'Nuevo adelanto en céntimos.', ejemplo: '15000' }, { nombre: 'entregaEl', queSeAnota: 'Nueva fecha de entrega, o vacío para quitarla.', ejemplo: '2026-03-22' }],
    ejemploTecleado: 'cambiar la orden OT-2026-0007: la entrega pasa al 22 de marzo',
    ejemploHablado: 'la orden siete ahora es para el veintidós',
    erroresComunes: ['La orden ya se entregó y no se puede editar.', 'El adelanto no puede superar el total del trabajo.', 'Hay que indicar al menos un dato.'],
    relacionadas: ['produccion_orden_ver', 'produccion_orden_estado'],
  },
  auditar: (a, d) => ({ ...auditarOrden(a, d), entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const o = await verOrden(tx, ctx, args.id, { bloquear: true });
    if (!o) return rechazo('no_encontrado', NO_EXISTE);
    if (!sePuedeEditar(o.estado as never)) return rechazo('conflicto', o.estado === 'entregado' ? 'La orden ya se entregó y no se puede editar.' : 'La orden está anulada: retómala antes de editarla.');
    if (args.clienteId && !(await clienteVigente(tx, ctx, args.clienteId))) return rechazo('argumentos_invalidos', CLIENTE_NO_VIGENTE);
    const nuevas = args.lineas ? preparar(args.lineas) : null;
    const total = nuevas?.totalCentimos ?? o.totalCentimos;
    const adelanto = args.adelantoCentimos ?? o.adelantoCentimos;
    const montos = comprobarMontos({ totalCentimos: total, adelantoCentimos: adelanto });
    if (!montos.ok) return rechazo('argumentos_invalidos', montos.motivo);
    const fechas = comprobarFechas(args.fecha ?? o.fecha, args.entregaEl !== undefined ? args.entregaEl : o.entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    if (nuevas) await reemplazarItems(tx, ctx, o.id, nuevas.lineas);
    await actualizarOrden(tx, ctx, o.id, {
      ...(args.clienteId !== undefined && { clienteId: args.clienteId }),
      ...(nuevas && { totalCentimos: total }),
      ...(args.adelantoCentimos !== undefined && { adelantoCentimos: args.adelantoCentimos }),
      ...(args.fecha !== undefined && { fecha: args.fecha }),
      ...(args.entregaEl !== undefined && { entregaEl: args.entregaEl }),
      ...(args.notas !== undefined && { notas: args.notas?.trim() || null }),
    });
    await agregarEvento(tx, ctx, { ordenId: o.id, tipo: 'editada', estadoAnterior: o.estado, estadoNuevo: o.estado, nota: `Total ${total}, adelanto ${adelanto}, falta ${saldoDe(total, adelanto)}` });
    return responderOrden(tx, ctx, o.id);
  },
});

export const ordenEstado = definirHerramienta('produccion_orden_estado', {
  modulo: MODULO,
  permiso: 'produccion:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar el estado de una orden de trabajo',
    paraQueSirve: 'Pasa la orden entre pendiente, en máquina, listo y entregado (adelante o atrás). Una anulada solo vuelve a pendiente; una entregada ya no cambia. Al entregarla, Finanzas propone cobrar lo que falta.',
    cuandoUsarla: 'Cuando el trabajo entra a máquina, queda listo o se entrega al cliente.',
    campos: [ID, { nombre: 'estado', queSeAnota: 'pendiente, en_maquina, listo o entregado.', ejemplo: 'en_maquina' }, { nombre: 'nota', queSeAnota: 'Comentario (opcional).', ejemplo: 'Entró a la máquina' }],
    ejemploTecleado: 'la orden OT-2026-0007 pasó a máquina',
    ejemploHablado: 'la orden siete ya está lista',
    erroresComunes: ['La orden ya se entregó y su estado no se puede cambiar.', 'La orden anulada solo puede volver a pendiente.'],
    relacionadas: ['produccion_orden_ver', 'produccion_orden_anular'],
  },
  auditar: auditarOrden,
  async ejecutar(args, ctx, tx) {
    const o = await verOrden(tx, ctx, args.id, { bloquear: true });
    if (!o) return rechazo('no_encontrado', NO_EXISTE);
    const cambio = comprobarCambioDeEstado(o.estado as never, args.estado);
    if (!cambio.ok) return rechazo('conflicto', cambio.motivo);
    if (o.estado === args.estado) return responderOrden(tx, ctx, o.id);
    await actualizarOrden(tx, ctx, o.id, { estado: args.estado, entregada: args.estado === 'entregado', reactivada: o.estado === 'anulada' });
    await agregarEvento(tx, ctx, { ordenId: o.id, tipo: 'estado', estadoAnterior: o.estado, estadoNuevo: args.estado, nota: args.nota?.trim() || null });
    if (args.estado === 'entregado') {
      await emitir(tx, 'produccion.orden_entregada', { id: o.id, codigo: codigoDeOrden(o.anio, o.numero), clienteId: o.clienteId, saldoCentimos: saldoDe(o.totalCentimos, o.adelantoCentimos) });
    }
    return responderOrden(tx, ctx, o.id);
  },
});

export const ordenCobrar = definirHerramienta('produccion_orden_cobrar', {
  modulo: MODULO,
  permiso: 'produccion:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anotar que el cliente ya pagó',
    paraQueSirve: 'Pide a Finanzas cobrar lo que falta de la orden: aparece en la bandeja como un cobro propuesto del saldo, que se confirma allí. La orden no mueve dinero por sí sola.',
    cuandoUsarla: 'Cuando el cliente paga el resto del trabajo.',
    campos: [ID],
    ejemploTecleado: 'ya me pagó la orden OT-2026-0007',
    ejemploHablado: 'Cristina ya pagó lo que faltaba de la orden siete',
    erroresComunes: ['Este trabajo ya está pagado del todo.', 'Una orden anulada no se cobra.'],
    relacionadas: ['deuda_abonar', 'produccion_orden_ver'],
  },
  auditar: auditarOrden,
  async ejecutar(args, ctx, tx) {
    const o = await verOrden(tx, ctx, args.id, { bloquear: true });
    if (!o) return rechazo('no_encontrado', NO_EXISTE);
    if (o.estado === 'anulada') return rechazo('conflicto', 'La orden está anulada y no se puede cobrar.');
    const saldo = saldoDe(o.totalCentimos, o.adelantoCentimos);
    if (saldo <= 0) return rechazo('conflicto', 'Este trabajo ya está pagado del todo.');
    await agregarEvento(tx, ctx, { ordenId: o.id, tipo: 'cobro', estadoAnterior: o.estado, estadoNuevo: o.estado, nota: `Se pidió cobrar el saldo: ${saldo} céntimos` });
    await emitir(tx, 'produccion.orden_cobro_pedido', { id: o.id, codigo: codigoDeOrden(o.anio, o.numero), clienteId: o.clienteId, saldoCentimos: saldo });
    return responderOrden(tx, ctx, o.id);
  },
});

export const ordenAnular = definirHerramienta('produccion_orden_anular', {
  modulo: MODULO,
  permiso: 'produccion:anular',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anular una orden de trabajo',
    paraQueSirve: 'Cancela una orden que todavía no se entregó y guarda el motivo. Si el cliente dejó un adelanto hay que decir si se devolvió o si la empresa se lo queda (en ese caso la orden queda por lo ya cobrado). Finanzas propone ajustar la deuda.',
    cuandoUsarla: 'Cuando el cliente cancela el trabajo o se cargó por error.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'El cliente canceló el pedido' }, { nombre: 'destinoAdelanto', queSeAnota: 'devuelto o retenido; obligatorio si hay adelanto.', ejemplo: 'devuelto' }],
    ejemploTecleado: 'anular la orden OT-2026-0007, el cliente canceló; le devolví el adelanto',
    ejemploHablado: 'anula la orden siete, el cliente se echó atrás y le devolví lo que dejó',
    erroresComunes: ['Este trabajo tiene un adelanto: hay que decir si se devolvió o se retuvo.', 'Solo se anula una orden que todavía no se entregó.'],
    relacionadas: ['produccion_orden_estado', 'deuda_anular'],
  },
  auditar: auditarOrden,
  async ejecutar(args, ctx, tx) {
    const o = await verOrden(tx, ctx, args.id, { bloquear: true });
    if (!o) return rechazo('no_encontrado', NO_EXISTE);
    if (!sePuedeAnular(o.estado as never)) return rechazo('conflicto', 'Solo se anula una orden que todavía no se entregó.');
    const anulacion = comprobarAnulacion(o.adelantoCentimos, args.destinoAdelanto);
    if (!anulacion.ok) return rechazo('argumentos_invalidos', anulacion.motivo);
    const destino = o.adelantoCentimos > 0 ? (args.destinoAdelanto ?? null) : null;
    await actualizarOrden(tx, ctx, o.id, { estado: 'anulada', anulada: { motivo: args.motivo, destinoAdelanto: destino }, ...(destino === 'retenido' && { totalCentimos: totalTrasRetener(o.adelantoCentimos) }) });
    await agregarEvento(tx, ctx, { ordenId: o.id, tipo: 'anulada', estadoAnterior: o.estado, estadoNuevo: 'anulada', nota: args.motivo });
    await emitir(tx, 'produccion.orden_anulada', { id: o.id, codigo: codigoDeOrden(o.anio, o.numero), adelantoCentimos: o.adelantoCentimos, destinoAdelanto: destino });
    return responderOrden(tx, ctx, o.id);
  },
});
