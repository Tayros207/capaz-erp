import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { candidatosParaGuia, cantidadesEnviadas, clienteParaGuia, lineasDePedidosParaGuia, listarGuias, pedidosDeGuias } from '../repositories/guias.repository.js';
import { verPedido, type Pedido } from '../repositories/pedidos.repository.js';
import { comprobarPedidoParaGuia } from '../domain/guia.js';
import { codigoDePedido } from '../domain/pedido.js';
import { MODULO, NO_EXISTE, alcanceDePedidos, estadoDe } from './comunes.js';
import { aGuiaDto, aPreparacionDeGuia } from './guia-mapeo.js';
import { ID_DE_GUIA, responderGuia } from './guias-comunes.js';

export const guiaPreparar = definirHerramienta('guia_preparar', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Preparar una guía de remisión',
    paraQueSirve: 'Muestra, de uno o varios pedidos de un mismo cliente, qué se pidió, qué ya se envió y qué falta enviar, junto con los datos del cliente y otros pedidos que se pueden sumar.',
    cuandoUsarla: 'Antes de emitir una guía, para saber qué se puede enviar.',
    campos: [
      { nombre: 'pedidoIds', queSeAnota: 'Los pedidos que van en la guía (hasta 20, del mismo cliente).', ejemplo: '["0192f0c4-7b1e-7000-8000-000000000010"]' },
      { nombre: 'clienteId', queSeAnota: 'El cliente, si todavía no eliges pedidos (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
    ],
    ejemploTecleado: 'preparar una guía del pedido PED-PRI-2026-0007',
    ejemploHablado: 'qué falta enviar del pedido siete',
    erroresComunes: ['Los pedidos son de clientes distintos: una guía lleva un solo cliente.', 'El pedido debe estar listo o entregado.', 'Indica los pedidos o el cliente.'],
    relacionadas: ['guia_emitir', 'pedido_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const alcance = alcanceDePedidos(ctx);
    const ids = [...new Set(args.pedidoIds)];
    const pedidos: Pedido[] = [];
    let clienteId = args.clienteId;
    for (const id of ids) {
      const p = await verPedido(tx, ctx, id, { alcance });
      if (!p) return rechazo('no_encontrado', NO_EXISTE);
      clienteId ??= p.clienteId;
      const paso = comprobarPedidoParaGuia({ estado: estadoDe(p), clienteId: p.clienteId, codigo: codigoDePedido(p.serie, p.anio, p.numero) }, clienteId);
      if (!paso.ok) return rechazo('conflicto', paso.motivo);
      pedidos.push(p);
    }
    const cliente = clienteId ? await clienteParaGuia(tx, ctx, clienteId) : null;
    if (!clienteId || !cliente || !cliente.vigente) return rechazo('argumentos_invalidos', 'El cliente no existe o está archivado.');
    const lineas = await lineasDePedidosParaGuia(tx, ctx, { pedidoIds: ids });
    const [enviadas, candidatos] = [await cantidadesEnviadas(tx, ctx, ids), await candidatosParaGuia(tx, ctx, alcance, { clienteId, excluir: ids })];
    return exito(aPreparacionDeGuia(cliente, pedidos, lineas, enviadas, candidatos));
  },
});

export const guiaVer = definirHerramienta('guia_ver', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver una guía de remisión',
    paraQueSirve: 'Muestra una guía tal como se emitió: destinatario, traslado, líneas y pedidos que cita.',
    cuandoUsarla: 'Cuando necesitas revisar o reimprimir una guía.',
    campos: [ID_DE_GUIA],
    ejemploTecleado: 'ver la guía G001-000007',
    ejemploHablado: 'abre la guía siete',
    erroresComunes: ['La guía no existe, es de otra empresa o no la emitiste tú.'],
    relacionadas: ['guias_listar', 'guia_anular'],
  },
  ejecutar: (args, ctx, tx) => responderGuia(tx, ctx, args.id),
});

export const guiasListar = definirHerramienta('guias_listar', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar guías de remisión',
    paraQueSirve: 'Muestra las guías, de la más nueva a la más antigua, por páginas. Se pueden filtrar por estado, cliente o pedido.',
    cuandoUsarla: 'Cuando quieres ver qué se envió, a quién o qué guías tiene un pedido.',
    campos: [
      { nombre: 'estado', queSeAnota: 'todas, emitida o anulada.', ejemplo: 'emitida' },
      { nombre: 'clienteId', queSeAnota: 'Solo las guías de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'pedidoId', queSeAnota: 'Solo las guías que citan ese pedido (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' },
    ],
    ejemploTecleado: 'ver las guías del pedido PED-PRI-2026-0007',
    ejemploHablado: 'qué guías salieron este mes',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['guia_ver', 'guia_emitir'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarGuias(tx, ctx, alcanceDePedidos(ctx), args);
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const pedidos = await pedidosDeGuias(tx, ctx, r.items.map((g) => g.id));
    return exito({ items: r.items.map((g) => aGuiaDto(g, pedidos.get(g.id) ?? [])), siguiente: r.siguiente });
  },
});
