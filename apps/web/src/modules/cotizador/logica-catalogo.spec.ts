import type { ProductoCotizableDto } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { calcularParaMostrar, detalleDeProducto, lineaManualDeCatalogo, opcionDeProducto, productoParaLista, textoSinPrecio } from './logica-catalogo.ts';

const catalogo: ProductoCotizableDto = { productoId: 'p1', listaId: null, nombre: 'Banner', unidad: 'm²', origen: 'catalogo', precioCatalogoSinIgvMilesimas: 25_000, afectoIgv: true };
const sinPrecio: ProductoCotizableDto = { productoId: 'p2', listaId: null, nombre: 'Rótulo', unidad: 'UND', origen: 'sin_precio', afectoIgv: true };

describe('qué cotizar', () => {
  it('cada origen se lee distinto en el selector', () => {
    expect(detalleDeProducto(catalogo)).toBe('S/ 25.00 sin IGV por m², precio del catálogo');
    expect(detalleDeProducto(sinPrecio)).toBe('sin precio');
    expect(detalleDeProducto({ ...catalogo, origen: 'lista', listaId: 'l1' })).toBe('precios por escala, por m²');
  });
  it('la opción usa el id de la lista si hay y el del producto si no', () => {
    expect(opcionDeProducto(catalogo).id).toBe('p1');
    expect(opcionDeProducto({ ...catalogo, origen: 'lista', listaId: 'l1' }).id).toBe('l1');
  });
  it('la línea del catálogo es manual, con producto y el precio sin IGV', () => {
    expect(lineaManualDeCatalogo(catalogo, 3_000)).toEqual({ tipo: 'manual', productoId: 'p1', descripcion: 'Banner', unidad: 'm²', cantidadMilesimas: 3_000, precioUnitarioMilesimas: 25_000 });
  });
  it('calcula importe, IGV y total para mostrar, redondeando la mitad hacia arriba', () => {
    expect(calcularParaMostrar(3_000, 25_000, 18)).toEqual({ importeCentimos: 7_500, igvCentimos: 1_350, totalCentimos: 8_850 });
    expect(calcularParaMostrar(1_000, 85, 18)).toEqual({ importeCentimos: 9, igvCentimos: 2, totalCentimos: 11 });
    expect(calcularParaMostrar(1_000, 1_000, 0).igvCentimos).toBe(0);
  });
  it('el texto de «sin precio» depende de si la persona puede fijarlo; solo un producto con id va a la lista', () => {
    expect(textoSinPrecio(true)).toMatch(/Fíjalo/);
    expect(textoSinPrecio(false)).toMatch(/Pide/);
    expect(productoParaLista(sinPrecio)).toEqual({ id: 'p2', nombre: 'Rótulo', unidad: 'UND' });
    expect(productoParaLista({ ...sinPrecio, productoId: null })).toBeNull();
  });
});
