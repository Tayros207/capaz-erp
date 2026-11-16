import type { FuenteDeTiempo } from '../../core/automatizaciones/tipos.js';
import { instanteDeDia } from '../../core/empresas/hoy.js';
import { codigoDePedido } from './domain/pedido.js';
import { pedidosConEntrega } from './repositories/resumen.repository.js';

/** La fecha de entrega de un pedido en curso. Con `dias` negativos una regla avisa antes de que venza. Solo lee. */
export const entregaVence: FuenteDeTiempo = {
  clave: 'ordenes.entrega_vence',
  modulo: 'ordenes',
  descripcion: 'Llega (o pasa) la fecha de entrega de un pedido confirmado, en proceso o listo.',
  async candidatos(tx) {
    const filas = await pedidosConEntrega(tx);
    return filas.map((f) => ({
      entidadTipo: 'pedido',
      entidadId: f.id,
      fecha: instanteDeDia(f.entrega_el),
      datos: { id: f.id, codigo: codigoDePedido(f.serie, f.anio, f.numero), clienteId: f.cliente_id, estado: f.estado, totalCentimos: Number(f.total_centimos) },
    }));
  },
};
