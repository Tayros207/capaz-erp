import { EVENTOS, formatearSoles } from '@capaz/shared';
import { proponerBorrador } from '../../core/borradores/proponer.js';
import type { Consumidor } from '../../core/eventos/tipos.js';
import { pedidoPorOrigen } from './repositories/pedidos.repository.js';

// Puente cotización → pedido (ficha §10.3). Regla R5: un consumidor NUNCA ejecuta herramientas ni escribe en las
// tablas del módulo; solo lee sus propias tablas y PROPONE un borrador. Una persona lo aprueba en la bandeja.

/** El tipo de origen con el que un pedido recuerda la cotización de la que nació (par blando, sin llave foránea: R6). */
const ORIGEN_COTIZACION = 'cotizacion';
/** Los únicos porcentajes de IGV que el pedido sabe calcular hoy (`IGV_POR_DEFECTO` es 18). */
const IGV_ADMITIDOS: readonly number[] = [18, 0];

/** Una cotización aceptada propone su pedido, salvo que ya exista un pedido vivo de esa cotización. */
export const ordenesCotizacionAceptada: Consumidor = {
  nombre: 'ordenes_cotizacion_aceptada',
  modulo: 'ordenes',
  evento: 'cotizacion.aceptada',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['cotizacion.aceptada'].parse(e.carga);
    if (await pedidoPorOrigen(tx, ctx, ORIGEN_COTIZACION, carga.id)) return;
    const igvAjeno = !IGV_ADMITIDOS.includes(carga.igvPorcentaje);
    const nota = `Cotización ${carga.codigo}`; // el código ya lleva «vN» desde la segunda versión
    await proponerBorrador(tx, {
      herramienta: 'pedido_crear',
      args: {
        clienteId: carga.clienteId,
        lineas: carga.lineas,
        notas: igvAjeno ? `${nota}. El IGV de la cotización es ${carga.igvPorcentaje} %: revisa los importes antes de aprobar.` : nota,
        origenTipo: ORIGEN_COTIZACION,
        origenId: carga.id,
      },
      resumen: `Crear el pedido de la cotización ${carga.codigo} por ${formatearSoles(carga.totalCentimos)}`,
      origen: 'modulo',
      origenRef: `cotizacion:${carga.id}`,
      ...(igvAjeno && { prioridad: 'alta' as const }),
      propuestoPor: 'sistema',
    });
  },
};

/** Una cotización anulada propone cancelar su pedido solo si sigue en borrador; en cualquier otro caso no hace nada. */
export const ordenesCotizacionAnulada: Consumidor = {
  nombre: 'ordenes_cotizacion_anulada',
  modulo: 'ordenes',
  evento: 'cotizacion.anulada',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['cotizacion.anulada'].parse(e.carga);
    const vivo = await pedidoPorOrigen(tx, ctx, ORIGEN_COTIZACION, carga.id);
    if (vivo?.estado !== 'borrador') return;
    await proponerBorrador(tx, {
      herramienta: 'pedido_cancelar',
      args: { id: vivo.id, motivo: `Cotización ${carga.codigo} anulada` },
      resumen: `Cancelar el pedido en borrador de la cotización ${carga.codigo}, que fue anulada`,
      origen: 'modulo',
      origenRef: `cotizacion:${carga.id}`,
      prioridad: 'alta',
      propuestoPor: 'sistema',
    });
  },
};

export const CONSUMIDORES_DE_ORDENES: readonly Consumidor[] = [ordenesCotizacionAceptada, ordenesCotizacionAnulada];
