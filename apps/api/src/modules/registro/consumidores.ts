import { EVENTOS, formatearSoles } from '@capaz/shared';
import { proponerBorrador } from '../../core/borradores/proponer.js';
import type { Consumidor } from '../../core/eventos/tipos.js';
import { deudaVivaPorOrigen } from './repositories/deudas.repository.js';

// Consumidores de eventos de otros módulos (ficha §4.5). Regla R5: un consumidor NUNCA ejecuta herramientas ni
// escribe en las tablas del módulo; solo lee sus propias tablas y PROPONE un borrador. El dinero lo confirma una
// persona en la bandeja. Aquí no se importa el ejecutor.

/** El tipo de origen con el que una deuda recuerda el pedido del que nació (par blando, sin llave foránea: R6). */
const ORIGEN_PEDIDO = 'pedido';

/** Un pedido confirmado con importe propone su cuenta por cobrar, salvo que ya exista una deuda viva de ese pedido. */
export const registroPedidoConfirmado: Consumidor = {
  nombre: 'registro_pedido_confirmado',
  modulo: 'registro',
  evento: 'pedido.confirmado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.confirmado'].parse(e.carga);
    if (carga.totalCentimos <= 0) return;
    if (await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id)) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_crear',
      args: {
        tipo: 'por_cobrar',
        contactoId: carga.clienteId,
        concepto: `Pedido ${carga.codigo}`,
        totalCentimos: carga.totalCentimos,
        venceEn: carga.entregaEl ?? undefined,
        origenTipo: ORIGEN_PEDIDO,
        origenId: carga.id,
      },
      resumen: `Cobrar ${formatearSoles(carga.totalCentimos)} por el pedido ${carga.codigo}`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      propuestoPor: 'sistema',
    });
  },
};

/** Un pedido cancelado propone anular su deuda viva, con prioridad alta. Sin deuda viva no hace nada. */
export const registroPedidoCancelado: Consumidor = {
  nombre: 'registro_pedido_cancelado',
  modulo: 'registro',
  evento: 'pedido.cancelado',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['pedido.cancelado'].parse(e.carga);
    const viva = await deudaVivaPorOrigen(tx, ctx, ORIGEN_PEDIDO, carga.id);
    if (!viva) return;
    await proponerBorrador(tx, {
      herramienta: 'deuda_anular',
      args: { id: viva.id, motivo: `Pedido ${carga.codigo} cancelado` },
      resumen: `Anular la deuda del pedido ${carga.codigo}, que fue cancelado`,
      origen: 'modulo',
      origenRef: `pedido:${carga.id}`,
      prioridad: 'alta',
      propuestoPor: 'sistema',
    });
  },
};

export const CONSUMIDORES_DE_REGISTRO: readonly Consumidor[] = [registroPedidoConfirmado, registroPedidoCancelado];
