import { formatearSoles, rechazo } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { NOMBRE_DE_ESTADO, comprobarAvance, comprobarCancelacion, comprobarConfirmacion } from '../domain/estados.js';
import { CLAVE_DE_CORRELATIVO, codigoDePedido, comprobarLineasParaConfirmar } from '../domain/pedido.js';
import { actualizarPedido, registrarEvento, serieDe, verPedido } from '../repositories/pedidos.repository.js';
import { ID, MODULO, NO_EXISTE, alcanceDePedidos, auditarPedido, estadoDe, responderPedido } from './comunes.js';

// Los pasos de un pedido: confirmar (le da número), avanzar o retroceder de estado, y cancelar (crítica).
// Cada paso deja su fila en el historial y su evento en la misma transacción.

export const pedidoConfirmar = definirHerramienta('pedido_confirmar', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Confirmar un pedido',
    paraQueSirve: 'Pasa el borrador a confirmado y le asigna su número correlativo. Desde ahí ya no se editan sus líneas.',
    cuandoUsarla: 'Cuando el cliente acepta y el pedido queda en firme.',
    campos: [ID],
    ejemploTecleado: 'confirmar el borrador de Imprenta Sol',
    ejemploHablado: 'confirma el pedido de Imprenta Sol',
    erroresComunes: ['Agrega al menos una línea antes de confirmar el pedido.', 'El pedido ya estaba confirmado.'],
    relacionadas: ['pedido_cambiar_estado', 'pedido_cancelar'],
  },
  auditar: auditarPedido,
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarConfirmacion(estadoDe(actual));
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const lineas = comprobarLineasParaConfirmar(actual.lineas);
    if (!lineas.ok) return rechazo('conflicto', lineas.motivo);
    const serie = await serieDe(tx, ctx, actual.sucursalId);
    if (!serie) return rechazo('conflicto', 'Tu empresa todavía no tiene una sucursal principal: vuelve a intentarlo en unos segundos.');
    const { anio } = await hoyDeLaEmpresa(tx);
    // El número se toma al final: si algo falla antes o después, la transacción lo devuelve (sin huecos).
    const numero = await siguienteNumero(tx, CLAVE_DE_CORRELATIVO, { serie, anio });
    await actualizarPedido(tx, ctx, actual.id, { estado: 'confirmado', numero, serie, anio, confirmadoAhora: true });
    await registrarEvento(tx, ctx, actual.id, { tipo: 'confirmado', estadoAnterior: 'borrador', estadoNuevo: 'confirmado' });
    await emitir(tx, 'pedido.confirmado', {
      id: actual.id,
      codigo: codigoDePedido(serie, anio, numero),
      clienteId: actual.clienteId,
      totalCentimos: actual.totalCentimos,
      entregaEl: actual.entregaEl,
      sucursalId: actual.sucursalId,
    });
    return responderPedido(tx, ctx, actual.id);
  },
});

export const pedidoCambiarEstado = definirHerramienta('pedido_cambiar_estado', {
  modulo: MODULO,
  permiso: 'ordenes:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar el estado de un pedido',
    paraQueSirve: 'Mueve un pedido confirmado entre confirmado, en proceso, listo y entregado. Entregado es el final.',
    cuandoUsarla: 'Cuando empiezas a trabajarlo, lo terminas o lo entregas; también para regresarlo un paso si te equivocaste.',
    campos: [ID, { nombre: 'estado', queSeAnota: 'confirmado, en_proceso, listo o entregado.', ejemplo: 'listo' }],
    ejemploTecleado: 'pasar el pedido PED-PRI-2026-0007 a listo',
    ejemploHablado: 'el pedido siete ya está listo',
    erroresComunes: ['Un borrador primero se confirma.', 'Un pedido entregado o cancelado ya no cambia.'],
    relacionadas: ['pedido_confirmar', 'pedido_cancelar'],
  },
  auditar: auditarPedido,
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const de = estadoDe(actual);
    const paso = comprobarAvance(de, args.estado);
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const entregado = args.estado === 'entregado';
    await actualizarPedido(tx, ctx, actual.id, { estado: args.estado, entregadoAhora: entregado });
    await registrarEvento(tx, ctx, actual.id, { tipo: 'estado', estadoAnterior: de, estadoNuevo: args.estado });
    if (entregado) {
      await emitir(tx, 'pedido.entregado', { id: actual.id, codigo: codigoDePedido(actual.serie, actual.anio, actual.numero), clienteId: actual.clienteId });
    }
    return responderPedido(tx, ctx, actual.id);
  },
});

export const pedidoCancelar = definirHerramienta('pedido_cancelar', {
  modulo: MODULO,
  permiso: 'ordenes:cancelar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Cancelar un pedido',
    paraQueSirve: 'Cancela un pedido que todavía no se entregó y guarda el motivo. El pedido no se borra y, si ya tenía número, lo conserva.',
    cuandoUsarla: 'Cuando el cliente desiste o el pedido se anotó por error.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se cancela.', ejemplo: 'El cliente ya no lo necesita' }],
    ejemploTecleado: 'cancelar el pedido PED-PRI-2026-0007 porque el cliente desistió',
    ejemploHablado: 'cancela el pedido siete, el cliente ya no lo quiere',
    erroresComunes: ['Un pedido entregado o ya cancelado no se cancela.', 'El pedido cambió mientras confirmabas: vuelve a pedir la cancelación.'],
    relacionadas: ['pedido_ver', 'pedido_cambiar_estado'],
  },
  auditar: auditarPedido,
  async resumir(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx) });
    if (!actual) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE } };
    const de = estadoDe(actual);
    const paso = comprobarCancelacion(de);
    if (!paso.ok) return { ok: false, error: { codigo: 'conflicto', mensaje: paso.motivo } };
    const codigo = codigoDePedido(actual.serie, actual.anio, actual.numero);
    const cual = actual.numero === null ? 'un pedido en borrador' : `el pedido ${codigo} (${NOMBRE_DE_ESTADO[de]})`;
    return {
      ok: true,
      resumen: {
        resumen: `Se cancelará ${cual} por ${formatearSoles(actual.totalCentimos)}. No se puede deshacer.`,
        huella: hashCanonico({ estado: actual.estado, totalCentimos: actual.totalCentimos }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const actual = await verPedido(tx, ctx, args.id, { alcance: alcanceDePedidos(ctx), bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    const de = estadoDe(actual);
    const paso = comprobarCancelacion(de);
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    await actualizarPedido(tx, ctx, actual.id, { estado: 'cancelado', canceladoAhora: true, canceladoPor: ctx.usuarioId, motivoCancelacion: args.motivo });
    await registrarEvento(tx, ctx, actual.id, { tipo: 'cancelado', estadoAnterior: de, estadoNuevo: 'cancelado' });
    // Solo un pedido que ya tenía número interesa a otros módulos; cancelar un borrador no emite.
    if (actual.numero !== null) {
      await emitir(tx, 'pedido.cancelado', { id: actual.id, codigo: codigoDePedido(actual.serie, actual.anio, actual.numero), clienteId: actual.clienteId, teniaNumero: true });
    }
    return responderPedido(tx, ctx, actual.id);
  },
});
