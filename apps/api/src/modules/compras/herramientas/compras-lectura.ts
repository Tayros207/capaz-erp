import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { listarCompras } from '../repositories/compras.repository.js';
import { resumenDeCompras } from '../repositories/resumen.repository.js';
import { aCompraDto } from './compra-mapeo.js';
import { ID, MODULO, alcanceDeCompras, responderCompra } from './comunes.js';

export const compraVer = definirHerramienta('compra_ver', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una orden de compra',
    paraQueSirve: 'Muestra una orden de compra con sus líneas, lo que falta recibir de cada una, sus recepciones y sus totales.',
    cuandoUsarla: 'Cuando necesitas saber qué se pidió a un proveedor, cuánto es o qué falta que llegue.',
    campos: [ID],
    ejemploTecleado: 'ver la orden de compra OC-PRI-2026-0001',
    ejemploHablado: 'abre la orden de compra uno de este año',
    erroresComunes: ['La orden no existe, es de otra empresa o no la creaste tú.'],
    relacionadas: ['compras_listar', 'compra_recibir'],
  },
  ejecutar: (args, ctx, tx) => responderCompra(tx, ctx, args.id),
});

export const comprasListar = definirHerramienta('compras_listar', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar órdenes de compra',
    paraQueSirve: 'Muestra las órdenes de compra, de la más nueva a la más antigua, por páginas. Sin filtro trae las abiertas.',
    cuandoUsarla: 'Cuando quieres ver qué falta que llegue, lo pedido a un proveedor o lo que vence en ciertas fechas.',
    campos: [
      { nombre: 'estado', queSeAnota: 'abiertas, por_recibir, borrador, enviada, recibida_parcial, recibida, cancelada o todas.', ejemplo: 'por_recibir' },
      { nombre: 'proveedorId', queSeAnota: 'Solo las órdenes de ese proveedor (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'entregaDesde', queSeAnota: 'Entrega desde ese día (opcional).', ejemplo: '2026-03-01' },
      { nombre: 'entregaHasta', queSeAnota: 'Entrega hasta ese día (opcional).', ejemplo: '2026-03-07' },
    ],
    ejemploTecleado: 'ver las compras por recibir',
    ejemploHablado: 'qué compras faltan que lleguen',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['compra_ver', 'compra_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarCompras(tx, ctx, alcanceDeCompras(ctx), args);
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const hoy = await hoyDeLaEmpresa(tx);
    return exito({ items: r.items.map((c) => aCompraDto(c, hoy.dia)), siguiente: r.siguiente });
  },
});

export const comprasResumen = definirHerramienta('compras_resumen', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen de compras',
    paraQueSirve: 'Cuenta las órdenes de un período por estado, lo comprado y lo recibido en esos días, y lo que hoy falta recibir o está atrasado.',
    cuandoUsarla: 'Cuando quieres saber cuánto se compró en la semana o el mes sin recorrer la lista.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen de compras de marzo',
    ejemploHablado: 'cuánto compramos este mes',
    erroresComunes: ['Tu acceso es solo a tus propios registros: el resumen es de toda la empresa.', 'El período empieza antes de terminar.'],
    relacionadas: ['compras_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (alcanceDeCompras(ctx) === 'propios') return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await resumenDeCompras(tx, { desde: args.desde, hasta: args.hasta, hoy: hoy.dia });
    return exito({ desde: args.desde, hasta: args.hasta, ...r });
  },
});
