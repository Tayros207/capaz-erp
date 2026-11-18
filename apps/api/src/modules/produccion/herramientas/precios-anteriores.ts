import { exito, type FilaDePrecioAnterior } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { codigoDeOrden } from '../domain/orden.js';
import { itemsDeOrdenesParaPrecios, type ItemConOrden } from '../repositories/precios-anteriores.repository.js';
import { MODULO } from './comunes.js';

/** El «valor acordado» de una orden no trae desglose de IGV: se muestra tal cual, sin convertirlo. */
export function aFilaDePrecio(f: ItemConOrden): FilaDePrecioAnterior {
  return {
    fuente: 'orden_trabajo',
    documento: { id: f.ordenId, codigo: codigoDeOrden(f.anio, f.numero), estado: f.estado, fecha: f.fecha },
    cliente: { id: f.clienteId, nombre: f.clienteNombre },
    productoId: null,
    descripcion: f.descripcion,
    unidad: f.unidad,
    cantidadMilesimas: f.cantidadMilesimas,
    precioUnitarioMilesimas: f.precioUnitarioMilesimas,
    baseDePrecio: 'sin_desglose',
    igvPorcentaje: null,
    precioConIgvMilesimas: null,
    precioSinIgvMilesimas: null,
    importeCentimos: f.subtotalCentimos,
    origen: null,
  };
}

export const ordenesPreciosAnteriores = definirHerramienta('produccion_precios_anteriores', {
  modulo: MODULO,
  permiso: 'produccion:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Precios anteriores en órdenes de trabajo',
    paraQueSirve: 'Entrega las líneas de órdenes de trabajo no anuladas de un cliente, de lo más nuevo a lo más antiguo, con el valor acordado.',
    cuandoUsarla: 'Cuando quieres saber cuánto se acordó antes por un trabajo; el núcleo la usa para armar «precio anterior».',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Solo las órdenes de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'raices', queSeAnota: 'Comienzos de palabra de la descripción para prefiltrar (opcional, hasta 12).', ejemplo: 'caj' },
      { nombre: 'desde', queSeAnota: 'Órdenes de ese día en adelante (opcional).', ejemplo: '2025-01-01' },
      { nombre: 'limiteDocumentos', queSeAnota: 'Cuántas órdenes como máximo, hasta 200 (por defecto 60).', ejemplo: '60' },
    ],
    ejemploTecleado: 'precios anteriores en órdenes de trabajo de Imprenta Sol',
    ejemploHablado: 'qué acordamos en trabajos con Imprenta Sol',
    erroresComunes: ['Hay que indicar al menos el cliente o una raíz de descripción.', 'Las líneas de una orden no tienen producto del catálogo: se buscan por su descripción.'],
    relacionadas: ['produccion_ordenes_listar'],
  },
  async ejecutar(args, ctx, tx) {
    // El producto del catálogo no existe en las órdenes: `productoId` solo se acepta por ser común a las tres herramientas.
    if (!args.clienteId && !args.raices?.length) return exito({ filas: [] });
    const filas = await itemsDeOrdenesParaPrecios(tx, ctx, args);
    return exito({ filas: filas.map(aFilaDePrecio) });
  },
});
