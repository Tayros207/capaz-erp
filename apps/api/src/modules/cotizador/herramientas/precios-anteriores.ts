import { exito, ponerIgv, type FilaDePrecioAnterior } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { codigoDeCotizacion } from '../domain/cotizacion.js';
import { lineasDeCotizacionesParaPrecios, type LineaConCotizacion } from '../repositories/precios-anteriores.repository.js';
import { alcanceDeCotizaciones } from './cotizacion-comun.js';
import { MODULO } from './comun.js';

/** El precio de una línea de cotización no lleva IGV; el total de la línea sí (`importeCentimos`). */
export function aFilaDePrecio(f: LineaConCotizacion): FilaDePrecioAnterior {
  return {
    fuente: 'cotizacion',
    documento: { id: f.cotizacionId, codigo: codigoDeCotizacion(f.numero, f.anio, f.version), estado: f.estado, fecha: f.fecha },
    cliente: { id: f.clienteId, nombre: f.clienteNombre },
    productoId: f.productoId,
    descripcion: f.descripcion,
    unidad: f.unidad,
    cantidadMilesimas: f.cantidadMilesimas,
    precioUnitarioMilesimas: f.precioUnitarioMilesimas,
    baseDePrecio: 'sin_igv',
    igvPorcentaje: f.igvPorcentaje,
    precioConIgvMilesimas: ponerIgv(f.precioUnitarioMilesimas, f.igvPorcentaje),
    precioSinIgvMilesimas: f.precioUnitarioMilesimas,
    importeCentimos: f.totalCentimos,
    origen: null,
  };
}

export const cotizadorPreciosAnteriores = definirHerramienta('cotizador_precios_anteriores', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Precios anteriores en cotizaciones',
    paraQueSirve: 'Entrega las líneas de cotizaciones emitidas, enviadas, aceptadas o rechazadas de un cliente o de un producto, de lo más nuevo a lo más antiguo.',
    cuandoUsarla: 'Cuando quieres saber cuánto se cotizó antes por un producto; el núcleo la usa para armar «precio anterior».',
    campos: [
      { nombre: 'clienteId', queSeAnota: 'Solo las cotizaciones de ese cliente (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'productoId', queSeAnota: 'Solo las líneas de ese producto del catálogo (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' },
      { nombre: 'raices', queSeAnota: 'Comienzos de palabra de la descripción para prefiltrar (opcional, hasta 12).', ejemplo: 'caj' },
      { nombre: 'desde', queSeAnota: 'Cotizaciones emitidas desde ese día (opcional).', ejemplo: '2025-01-01' },
      { nombre: 'limiteDocumentos', queSeAnota: 'Cuántas cotizaciones como máximo, hasta 200 (por defecto 60).', ejemplo: '60' },
    ],
    ejemploTecleado: 'precios anteriores en cotizaciones de Imprenta Sol',
    ejemploHablado: 'qué le cotizamos a Imprenta Sol',
    erroresComunes: ['Hay que indicar al menos el cliente, el producto o una raíz de descripción.', 'Con alcance «propios» solo salen tus cotizaciones.'],
    relacionadas: ['cotizaciones_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const filas = await lineasDeCotizacionesParaPrecios(tx, ctx, alcanceDeCotizaciones(ctx), hoy.zona, args);
    return exito({ filas: filas.map(aFilaDePrecio) });
  },
});
