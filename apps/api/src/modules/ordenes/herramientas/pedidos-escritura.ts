import { calcularTotalesDePedido, IGV_POR_DEFECTO, ORIGEN_DE_HISTORIAL, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { esEditable } from '../domain/estados.js';
import { codigoDePedido, comprobarFechas } from '../domain/pedido.js';
import { actualizarPedido, crearPedido, lineasDe, pedidoPorOrigen, reemplazarLineas, registrarEvento, verPedido } from '../repositories/pedidos.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDePedidos, auditarPedido, comprobarReferencias, estadoDe, prepararLineasDe, responderPedido } from './comunes.js';

const CAMPOS_DE_LINEA = {
  nombre: 'lineas',
  queSeAnota: 'Lo pedido: por línea, un producto o una descripción con precio (el precio ya incluye IGV) y la cantidad en milésimas. Opcional por línea: la ficha de máquina (material, medida, colores, acabado), solo si la persona la escribió: nunca se supone.',
  ejemplo: '[{ "descripcion": "Volantes A5", "cantidadMilesimas": 2000, "precioUnitarioMilesimas": 59000 }]',
};

/** Los totales de las líneas que el borrador ya tiene, con o sin IGV. Los precios no cambian: solo si el IGV se detalla. */
function totalesConIgv(lineas: Parameters<typeof calcularTotalesDePedido>[0], conIgv: boolean) {
  const igvPorcentaje = conIgv ? IGV_POR_DEFECTO : 0;
  const { subtotalCentimos, igvCentimos, totalCentimos } = calcularTotalesDePedido(lineas, igvPorcentaje);
  return { igvPorcentaje, subtotalCentimos, igvCentimos, totalCentimos };
}

export const pedidoCrear = definirHerramienta('pedido_crear', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un pedido',
    paraQueSirve: 'Abre un pedido en borrador para un cliente, con sus líneas. Todavía no tiene número: lo recibe al confirmarlo.',
    cuandoUsarla: 'Cuando un cliente te encarga algo y quieres dejarlo anotado.',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Identificador del cliente.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'entregaEl', queSeAnota: 'Día de entrega acordado (opcional).', ejemplo: '2026-03-15' },
      CAMPOS_DE_LINEA,
      { nombre: 'notas', queSeAnota: 'Indicaciones del pedido (opcional).', ejemplo: 'Entregar en la tienda del centro' },
    ],
    ejemploTecleado: 'nuevo pedido para Imprenta Sol: 2 millares de volantes A5 a 59 soles, entrega el 15 de marzo',
    ejemploHablado: 'anota un pedido de Imprenta Sol, dos millares de volantes a cincuenta y nueve soles para el quince',
    erroresComunes: ['El cliente no existe o está archivado.', 'Una línea sin producto necesita descripción y precio.', 'La entrega no puede ser anterior a la fecha del pedido.'],
    relacionadas: ['pedido_editar', 'pedido_confirmar', 'clientes_buscar', 'productos_buscar'],
  },
  auditar: auditarPedido,
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const fecha = args.fecha ?? hoy.dia;
    if (args.origenTipo === ORIGEN_DE_HISTORIAL) return rechazo('argumentos_invalidos', 'Ese origen está reservado para el historial importado.');
    const entregaEl = args.entregaEl ?? null;
    const fechas = comprobarFechas(fecha, entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const falta = await comprobarReferencias(tx, ctx, args);
    if (falta) return rechazo('argumentos_invalidos', falta);
    const igvPorcentaje = args.conIgv === false ? 0 : IGV_POR_DEFECTO;
    const p = await prepararLineasDe(tx, ctx, args.lineas, igvPorcentaje);
    if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
    const datos = {
      clienteId: args.clienteId,
      fecha,
      entregaEl,
      responsableId: args.responsableId || null,
      notas: args.notas || null,
      sucursalId: args.sucursalId ?? null,
      origenTipo: args.origenTipo ?? null,
      origenId: args.origenId ?? null,
      igvPorcentaje,
    };
    const id = await crearPedido(tx, ctx, datos, p);
    if (!id) {
      const otro = await pedidoPorOrigen(tx, ctx, args.origenTipo!, args.origenId!);
      if (!otro) throw new Error('Conflicto de unicidad de pedidos sin fila que lo explique.');
      const codigo = codigoDePedido(otro.serie, otro.anio, otro.numero);
      return rechazo('conflicto', 'Ya hay un pedido creado desde ese mismo origen.', [{ id: otro.id, nombre: codigo }]);
    }
    await reemplazarLineas(tx, ctx, id, p.lineas);
    await registrarEvento(tx, ctx, id, { tipo: 'creado', estadoNuevo: 'borrador' });
    return responderPedido(tx, ctx, id);
  },
});

export const pedidoEditar = definirHerramienta('pedido_editar', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Editar un pedido en borrador',
    paraQueSirve: 'Cambia el cliente, la entrega, el responsable, las notas, el IGV o las líneas de un borrador. Para ponerle o quitarle el IGV (factura o sin IGV) manda solo el id y conIgv, SIN líneas. Si envías líneas, reemplazan a todas las anteriores.',
    cuandoUsarla: 'Mientras el pedido no está confirmado y hay que corregirlo o completarlo.',
    campos: [ID, { nombre: 'entregaEl', queSeAnota: 'Nuevo día de entrega, o vacío para quitarlo.', ejemplo: '2026-03-20' }, CAMPOS_DE_LINEA],
    ejemploTecleado: 'cambiar la entrega del borrador de Imprenta Sol al 20 de marzo',
    ejemploHablado: 'la entrega del pedido de Imprenta Sol pasa al veinte',
    erroresComunes: ['Solo se edita un pedido en borrador.', 'Hay que indicar al menos un dato.', 'La entrega no puede ser anterior a la fecha del pedido.'],
    relacionadas: ['pedido_ver', 'pedido_confirmar'],
  },
  auditar: (a, d) => ({
    ...auditarPedido(a, d),
    entidadId: a.id,
    resumen: { campos: Object.keys(a).filter((k) => k !== 'id' && a[k as keyof typeof a] !== undefined).sort().join(','), ...(d && { lineas: d.lineas, totalCentimos: d.totalCentimos }) },
  }),
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    if (!esEditable(estadoDe(actual))) return rechazo('conflicto', 'Solo se edita un pedido en borrador.');
    const { id, lineas, conIgv, ...campos } = args;
    const fechas = comprobarFechas(actual.fecha, campos.entregaEl !== undefined ? campos.entregaEl : actual.entregaEl);
    if (!fechas.ok) return rechazo('argumentos_invalidos', fechas.motivo);
    const falta = await comprobarReferencias(tx, ctx, campos);
    if (falta) return rechazo('argumentos_invalidos', falta);
    let totales = {};
    if (lineas) {
      const igvPorcentaje = conIgv === undefined ? actual.igvPorcentaje : conIgv ? IGV_POR_DEFECTO : 0;
      const p = await prepararLineasDe(tx, ctx, lineas, igvPorcentaje);
      if (!p.ok) return rechazo('argumentos_invalidos', p.motivo);
      await reemplazarLineas(tx, ctx, id, p.lineas);
      totales = {
        ...(conIgv !== undefined && { igvPorcentaje }),
        subtotalCentimos: p.subtotalCentimos,
        igvCentimos: p.igvCentimos,
        totalCentimos: p.totalCentimos,
      };
    } else if (conIgv !== undefined) {
      totales = totalesConIgv(await lineasDe(tx, ctx, id), conIgv);
    }
    await actualizarPedido(tx, ctx, id, {
      ...campos,
      ...(campos.responsableId !== undefined && { responsableId: campos.responsableId || null }),
      ...(campos.notas !== undefined && { notas: campos.notas || null }),
      ...totales,
    });
    await registrarEvento(tx, ctx, id, { tipo: 'editado' });
    return responderPedido(tx, ctx, id);
  },
});

export const pedidoAnotar = definirHerramienta('pedido_anotar', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anotar algo en un pedido',
    paraQueSirve: 'Deja una nota en el historial del pedido, en cualquier estado. La nota no se borra.',
    cuandoUsarla: 'Cuando el cliente llama, cambia una indicación o quieres dejar constancia de algo.',
    campos: [ID, { nombre: 'nota', queSeAnota: 'Lo que quieres dejar anotado.', ejemplo: 'El cliente pasará a recoger el viernes por la tarde' }],
    ejemploTecleado: 'anotar en el pedido PED-PRI-2026-0007: recoge el viernes por la tarde',
    ejemploHablado: 'anota en el pedido siete que el cliente recoge el viernes',
    erroresComunes: ['El pedido no existe, es de otra empresa o no está a tu cargo.', 'La nota no puede estar vacía.'],
    relacionadas: ['pedido_ver'],
  },
  auditar: (a, d) => ({ entidadTipo: 'pedido', entidadId: a.id, ...(d && { resumen: { codigo: d.codigo, estado: d.estado } }) }),
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx) });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    await registrarEvento(tx, ctx, args.id, { tipo: 'nota', nota: args.nota });
    return responderPedido(tx, ctx, args.id);
  },
});
