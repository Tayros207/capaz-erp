import { importe, type LineaDeCotizacionEntrada, type ProductoCotizableDto } from '@capaz/shared';
import { milesimasATexto } from '../../shared/formato/milesimas.ts';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';

// Lógica pura del buscador «qué cotizar»: el catálogo manda y la lista de precios es una capa por escala sobre el producto.
// El precio del catálogo ya llega SIN IGV (lo convierte el servidor); aquí solo se muestra y se arma la línea.

export const TEXTO_DE_ORIGEN: Readonly<Record<ProductoCotizableDto['origen'], string>> = {
  lista: 'Precios por escala', catalogo: 'Precio del catálogo', sin_precio: 'Sin precio',
};

/** Lo que se lee en cada opción del selector. */
export function detalleDeProducto(p: ProductoCotizableDto): string {
  if (p.origen === 'lista') return `precios por escala, por ${p.unidad}`;
  if (p.origen === 'catalogo') return `S/ ${milesimasATexto(p.precioCatalogoSinIgvMilesimas ?? 0)} sin IGV por ${p.unidad}, precio del catálogo`;
  return 'sin precio';
}

/** La opción del selector: su id es el de la lista cuando hay, y el del producto cuando no. */
export const opcionDeProducto = (p: ProductoCotizableDto): Opcion => ({ id: p.listaId ?? p.productoId ?? p.nombre, nombre: p.nombre, detalle: detalleDeProducto(p) });

/** Una línea manual con el precio del catálogo (sin IGV); el servidor recalcula importe, IGV y total. */
export function lineaManualDeCatalogo(p: ProductoCotizableDto, cantidadMilesimas: number): LineaDeCotizacionEntrada {
  return {
    tipo: 'manual',
    ...(p.productoId && { productoId: p.productoId }),
    descripcion: p.nombre,
    unidad: p.unidad,
    cantidadMilesimas,
    precioUnitarioMilesimas: p.precioCatalogoSinIgvMilesimas ?? 0,
  };
}

/** Solo para mostrar: importe = cantidad × unitario; IGV = importe × igv / 100 (mitad hacia arriba). El servidor recalcula al crear. */
export function calcularParaMostrar(cantidadMilesimas: number, precioUnitarioMilesimas: number, igvPorcentaje: number): { importeCentimos: number; igvCentimos: number; totalCentimos: number } {
  const importeCentimos = importe(cantidadMilesimas, precioUnitarioMilesimas);
  const igvCentimos = Math.floor((2 * importeCentimos * igvPorcentaje + 100) / 200);
  return { importeCentimos, igvCentimos, totalCentimos: importeCentimos + igvCentimos };
}

/** Texto de ayuda cuando el producto no tiene precio, según pueda o no fijarlo. */
export const textoSinPrecio = (puedeFijar: boolean): string =>
  puedeFijar ? 'Este producto no tiene precio. Fíjalo para poder cotizarlo.' : 'Este producto no tiene precio. Pide a quien configura el Cotizador que lo fije.';

/** Lo que `HojaDeLista` recibe para empezar desde un producto del catálogo. */
export type ProductoParaLista = { id: string; nombre: string; unidad: string };
export const productoParaLista = (p: ProductoCotizableDto): ProductoParaLista | null => (p.productoId ? { id: p.productoId, nombre: p.nombre, unidad: p.unidad } : null);

/** La cantidad de una cotización de catálogo no tiene tope de escala; solo debe ser mayor que cero. */
export const validarCantidadDeCatalogo = (milesimas: number | null): string | undefined => (milesimas === null || milesimas <= 0 ? 'Escribe la cantidad.' : undefined);
