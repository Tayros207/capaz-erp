import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { listarPedidos } from '../repositories/pedidos.repository.js';
import { resumenDePedidos } from '../repositories/resumen.repository.js';
import { ID, MODULO, alcanceDePedidos, responderPedido } from './comunes.js';
import { aPedidoDto } from './pedido-mapeo.js';

export const pedidoVer = definirHerramienta('pedido_ver', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un pedido',
    paraQueSirve: 'Muestra un pedido con sus líneas, sus totales y todo lo que le pasó.',
    cuandoUsarla: 'Cuando necesitas saber qué pidió un cliente, cuánto es o en qué va.',
    campos: [ID],
    ejemploTecleado: 'ver el pedido PED-PRI-2026-0007',
    ejemploHablado: 'abre el pedido siete de este año',
    erroresComunes: ['El pedido no existe, es de otra empresa o no está a tu cargo.'],
    relacionadas: ['pedidos_listar', 'pedido_editar'],
  },
  ejecutar: (args, ctx, tx) => responderPedido(tx, ctx, args.id),
});

export const pedidosListar = definirHerramienta('pedidos_listar', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar pedidos',
    paraQueSirve: 'Muestra los pedidos, del más nuevo al más antiguo, por páginas. Sin filtro trae los abiertos.',
    cuandoUsarla: 'Cuando quieres ver qué hay pendiente, lo de un cliente o lo que se entrega en ciertas fechas.',
    campos: [
      { nombre: 'estado', queSeAnota: 'abiertos, borrador, confirmado, en_proceso, listo, entregado, cancelado o todos.', ejemplo: 'abiertos' },
      { nombre: 'clienteId', queSeAnota: 'Solo los pedidos de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'entregaDesde', queSeAnota: 'Entrega desde ese día (opcional).', ejemplo: '2026-03-01' },
      { nombre: 'entregaHasta', queSeAnota: 'Entrega hasta ese día (opcional).', ejemplo: '2026-03-07' },
    ],
    ejemploTecleado: 'ver los pedidos abiertos',
    ejemploHablado: 'qué pedidos tengo pendientes',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['pedido_ver', 'pedido_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarPedidos(tx, ctx, alcanceDePedidos(ctx), args);
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const hoy = await hoyDeLaEmpresa(tx);
    return exito({ items: r.items.map((p) => aPedidoDto(p, hoy.dia)), siguiente: r.siguiente });
  },
});

export const ordenesResumen = definirHerramienta('ordenes_resumen', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen de pedidos',
    paraQueSirve: 'Cuenta los pedidos de un período por estado, lo confirmado y entregado en esos días, y lo atrasado y lo que se entrega hoy.',
    cuandoUsarla: 'Cuando quieres saber cómo va la semana o el mes sin recorrer la lista.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen de pedidos de marzo',
    ejemploHablado: 'cómo van los pedidos este mes',
    erroresComunes: ['Tu acceso es solo a tus propios registros: el resumen es de toda la empresa.', 'El período empieza antes de terminar.'],
    relacionadas: ['pedidos_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (alcanceDePedidos(ctx) === 'propios') return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await resumenDePedidos(tx, { desde: args.desde, hasta: args.hasta, hoy: hoy.dia, zona: hoy.zona });
    return exito({ desde: args.desde, hasta: args.hasta, ...r });
  },
});
