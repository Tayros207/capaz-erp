import type { FuenteDeTiempo } from '../../core/automatizaciones/tipos.js';
import { instanteDeDia } from '../../core/empresas/hoy.js';
import { codigoDeOrden } from './domain/orden.js';
import { comprasConEntrega } from './repositories/resumen.repository.js';

/** La fecha de entrega de una orden enviada o recibida en parte. Con `dias` negativos una regla avisa antes. Solo lee. */
export const entregaVence: FuenteDeTiempo = {
  clave: 'compras.entrega_vence',
  modulo: 'compras',
  descripcion: 'Llega (o pasa) la fecha en que el proveedor debe entregar una orden de compra que falta recibir.',
  async candidatos(tx) {
    const filas = await comprasConEntrega(tx);
    return filas.map((f) => ({
      entidadTipo: 'compra',
      entidadId: f.id,
      fecha: instanteDeDia(f.entrega_el),
      datos: { id: f.id, codigo: codigoDeOrden(f.serie, f.anio, f.numero), proveedorId: f.proveedor_id, estado: f.estado, totalCentimos: Number(f.total_centimos) },
    }));
  },
};
