import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { itemsDeOrdenes, listarOrdenes } from '../repositories/ordenes.repository.js';
import { ID, ID_DE_EJEMPLO, MODULO, responderOrden } from './comunes.js';
import { aOrdenDto } from './mapeo.js';

export const ordenesListar = definirHerramienta('produccion_ordenes_listar', {
  modulo: MODULO,
  permiso: 'produccion:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las órdenes de producción',
    paraQueSirve: 'Muestra las órdenes, las más recientes primero y por páginas, con su cantidad, total, adelanto y lo que falta cancelar. Por defecto, las que están en cola del taller.',
    cuandoUsarla: 'Para ver qué hay en taller, qué está atrasado y cuánto falta cobrar.',
    campos: [
      { nombre: 'estado', queSeAnota: 'en_cola (pendiente, en máquina y listo; por defecto), pendiente, en_maquina, listo, entregado, anulada o todas.', ejemplo: 'en_cola' },
      { nombre: 'buscar', queSeAnota: 'Texto: cliente, número, notas o lo escrito en las líneas (opcional).', ejemplo: 'volantes' },
      { nombre: 'desde', queSeAnota: 'Fecha inicial (opcional).', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Fecha final (opcional).', ejemplo: '2026-03-31' },
      { nombre: 'clienteId', queSeAnota: 'Solo de este cliente (opcional).', ejemplo: ID_DE_EJEMPLO },
    ],
    ejemploTecleado: 'órdenes del taller en cola',
    ejemploHablado: 'qué trabajos hay en taller',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['produccion_orden_ver', 'produccion_orden_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarOrdenes(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado, desde: args.desde, hasta: args.hasta, clienteId: args.clienteId, buscar: args.buscar });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const hoy = await hoyDeLaEmpresa(tx);
    const items = await itemsDeOrdenes(tx, ctx, r.items.map((o) => o.id));
    return exito({ items: r.items.map((o) => aOrdenDto(o, items.get(o.id) ?? [], hoy.dia)), siguiente: r.siguiente });
  },
});

export const ordenVer = definirHerramienta('produccion_orden_ver', {
  modulo: MODULO,
  permiso: 'produccion:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una orden de producción',
    paraQueSirve: 'Muestra la orden con su cantidad, total, adelanto, lo que falta cancelar y su historial de estados.',
    cuandoUsarla: 'Para revisar en qué va un trabajo y cuánto falta cobrar.',
    campos: [ID],
    ejemploTecleado: 'ver la orden OP-2026-0007',
    ejemploHablado: 'cómo va la orden siete',
    erroresComunes: ['La orden no existe o es de otra empresa.'],
    relacionadas: ['produccion_ordenes_listar', 'produccion_orden_estado'],
  },
  async ejecutar(args, ctx, tx) {
    return responderOrden(tx, ctx, args.id);
  },
});
