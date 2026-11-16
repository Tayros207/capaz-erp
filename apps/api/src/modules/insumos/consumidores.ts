import { EVENTOS } from '@capaz/shared';
import { proponerBorrador } from '../../core/borradores/proponer.js';
import type { Consumidor } from '../../core/eventos/tipos.js';
import { lineasParaRecibir, ORIGEN_RECEPCION, resumenDeRecepcion } from './domain/recepcion.js';
import { articulosActivosPorProducto } from './repositories/articulos.repository.js';
import { movimientosDeOrigen } from './repositories/movimientos.repository.js';

// Consumidores de eventos de otros módulos (FICHAS-OLA-3 §2 y P3-3). Regla R5: un consumidor NUNCA ejecuta
// herramientas ni escribe en las tablas del módulo; solo lee sus propias tablas y PROPONE un borrador. La entrada
// al inventario la aprueba una persona en la bandeja. Aquí no se importa el ejecutor.

/**
 * Una compra recibida propone UN borrador de `existencias_recibir` con todas sus líneas que tienen artículo activo
 * (agrupadas por artículo). Sin líneas así, o si esa recepción ya entró al inventario, no propone nada. El evento no
 * trae la sucursal: el borrador va sin ella y la entrada cae en la principal (se puede cambiar antes de aprobar).
 */
export const insumosCompraRecibida: Consumidor = {
  nombre: 'insumos_compra_recibida',
  modulo: 'insumos',
  evento: 'compra.recibida',
  async manejar(e, ctx, tx) {
    const carga = EVENTOS['compra.recibida'].parse(e.carga);
    const productos = carga.lineas.flatMap((l) => (l.productoId ? [l.productoId] : []));
    const lineas = lineasParaRecibir(carga.lineas, await articulosActivosPorProducto(tx, ctx, productos));
    if (lineas.length === 0) return;
    if ((await movimientosDeOrigen(tx, ctx, ORIGEN_RECEPCION, carga.recepcionId)).length > 0) return;
    await proponerBorrador(tx, {
      herramienta: 'existencias_recibir',
      args: { origenTipo: ORIGEN_RECEPCION, origenId: carga.recepcionId, motivo: `Compra ${carga.numero}`, lineas },
      resumen: resumenDeRecepcion(lineas.length, carga.numero),
      origen: 'modulo',
      origenRef: `${ORIGEN_RECEPCION}:${carga.recepcionId}`,
      propuestoPor: 'sistema',
    });
  },
};

export const CONSUMIDORES_DE_INSUMOS: readonly Consumidor[] = [insumosCompraRecibida];
