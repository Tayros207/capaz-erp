import { exito, quitarIgv, type FilaDePrecioAnterior } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { codigoDePedido } from '../domain/pedido.js';
import { lineasDePedidosParaPrecios, type LineaConPedido } from '../repositories/precios-anteriores.repository.js';
import { MODULO, alcanceDePedidos } from './comunes.js';

/**
 * Una línea de pedido como fila de precio anterior. El precio de una línea afecta incluye el IGV del pedido
 * (D17); una línea no afecta no lleva IGV: sus dos precios coinciden.
 */
export function aFilaDePrecio(f: LineaConPedido): FilaDePrecioAnterior {
  const precio = f.precioUnitarioMilesimas;
  return {
    fuente: 'pedido',
    documento: { id: f.pedidoId, codigo: codigoDePedido(f.serie, f.anio, f.numero), estado: f.estado, fecha: f.fecha },
    cliente: { id: f.clienteId, nombre: f.clienteNombre },
    productoId: f.productoId,
    descripcion: f.descripcion,
    unidad: f.unidad,
    cantidadMilesimas: f.cantidadMilesimas,
    precioUnitarioMilesimas: precio,
    baseDePrecio: f.afectoIgv ? 'con_igv' : 'sin_igv',
    igvPorcentaje: f.afectoIgv ? f.igvPorcentaje : 0,
    precioConIgvMilesimas: precio,
    precioSinIgvMilesimas: f.afectoIgv ? quitarIgv(precio, f.igvPorcentaje) : precio,
    importeCentimos: f.importeCentimos,
    origen: f.origenTipo && f.origenId ? { tipo: f.origenTipo, id: f.origenId } : null,
  };
}

export const pedidosPreciosAnteriores = definirHerramienta('ordenes_precios_anteriores', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Precios anteriores en pedidos',
    paraQueSirve: 'Entrega las líneas de pedidos confirmados (o más avanzados) de un cliente o de un producto, de lo más nuevo a lo más antiguo, con su precio y su fecha.',
    cuandoUsarla: 'Cuando quieres saber cuánto se cobró antes por un producto; el núcleo la usa para armar «precio anterior».',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Solo los pedidos de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'productoId', queSeAnota: 'Solo las líneas de ese producto del catálogo (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' },
      { nombre: 'raices', queSeAnota: 'Comienzos de palabra de la descripción para prefiltrar (opcional, hasta 12).', ejemplo: 'caj' },
      { nombre: 'desde', queSeAnota: 'Pedidos de ese día en adelante (opcional).', ejemplo: '2025-01-01' },
      { nombre: 'limiteDocumentos', queSeAnota: 'Cuántos pedidos como máximo, hasta 200 (por defecto 60).', ejemplo: '60' },
    ],
    ejemploTecleado: 'precios anteriores de pedidos de Imprenta Sol',
    ejemploHablado: 'qué le cobramos en pedidos a Imprenta Sol',
    erroresComunes: ['Hay que indicar al menos el cliente, el producto o una raíz de descripción.', 'Con alcance «propios» solo salen tus pedidos.'],
    relacionadas: ['pedidos_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const filas = await lineasDePedidosParaPrecios(tx, ctx, alcanceDePedidos(ctx), args);
    return exito({ filas: filas.map(aFilaDePrecio) });
  },
});
