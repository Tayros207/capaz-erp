import { describe, expect, it } from 'vitest';
import type { LineaDeMovimientoDto } from '@capaz/shared';
import {
  claveSiguiente, filaConCantidad, filaConPrecio, filaConSubtotal, filaDeCatalogo, filaDeLineaGuardada, filaDeProductoVacia, filaLibre, lineasDeFilas, mismasQueLasGuardadas,
  motivoDeProductosIncompletos, subtotalDeFila, totalDeFilas,
} from './logica-lineas.ts';

const catalogo = { id: 'p1', nombre: 'Etiquetas adhesivas', unidad: 'millar', precioUnitarioMilesimas: 65_000 };
const guardada = (n: number): LineaDeMovimientoDto => ({ id: `l${n}`, orden: n, productoId: null, descripcion: 'Bolsas', unidad: 'unidad', cantidadMilesimas: 100_000, precioUnitarioMilesimas: 1_900, subtotalCentimos: 19_000 });

describe('filas de producto', () => {
  it('un producto del catálogo trae nombre, unidad y precio; el subtotal sale de cantidad × precio', () => {
    const f = filaConCantidad(filaDeCatalogo('a', catalogo), 2000);
    expect(f).toMatchObject({ elegida: true, productoId: 'p1', descripcion: 'Etiquetas adhesivas', unidad: 'millar' });
    expect(subtotalDeFila(f)).toBe(13_000);
  });

  it('el texto libre no lleva producto y espera precio', () => {
    const f = filaLibre('b', '  Diseño de logo ');
    expect(f).toMatchObject({ productoId: null, descripcion: 'Diseño de logo', elegida: true });
    expect(subtotalDeFila(f)).toBeNull();
  });

  it('escribir el subtotal manda: el unitario se recalcula al cambiar la cantidad; escribir el precio devuelve el mando', () => {
    let f = filaConSubtotal(filaDeProductoVacia('c'), 13_000); // cantidad 1 unidad
    expect(f.precioUnitarioMilesimas).toBe(130_000);
    f = filaConCantidad(f, 2000);
    expect(f.precioUnitarioMilesimas).toBe(65_000);
    expect(subtotalDeFila(f)).toBe(13_000);
    f = filaConPrecio(f, 70_000);
    expect(f.manda).toBe('precio');
    expect(subtotalDeFila(f)).toBe(14_000);
  });

  it('el total suma los subtotales y es nulo si alguna fila está incompleta', () => {
    const a = filaConCantidad(filaDeCatalogo('a', catalogo), 2000);
    const b = filaDeLineaGuardada(guardada(1), 'g');
    expect(totalDeFilas([a, b])).toBe(32_000);
    expect(totalDeFilas([a, filaLibre('x', 'Sin precio')])).toBeNull();
    expect(totalDeFilas([])).toBe(0);
  });

  it('dice por qué no se pueden guardar y lo calla cuando están completas', () => {
    expect(motivoDeProductosIncompletos([filaLibre('x', '')])).toBe('Producto 1: Escribe qué producto es.');
    expect(motivoDeProductosIncompletos([filaLibre('x', 'Algo')])).toBe('Producto 1: Falta el precio.');
    expect(motivoDeProductosIncompletos([filaConCantidad(filaDeCatalogo('a', catalogo), 0)])).toBe('Producto 1: La cantidad debe ser mayor que cero.');
    expect(motivoDeProductosIncompletos([filaConPrecio(filaLibre('x', 'Regalo'), 0)])).toBe('La suma de los productos debe ser mayor que cero.');
    expect(motivoDeProductosIncompletos([filaDeCatalogo('a', catalogo)])).toBeNull();
    expect(motivoDeProductosIncompletos([])).toBeNull();
  });

  it('lo que viaja lleva productoId solo si es del catálogo y no lleva subtotal', () => {
    const lineas = lineasDeFilas([filaConCantidad(filaDeCatalogo('a', catalogo), 2000), filaConPrecio(filaLibre('b', 'Diseño'), 5_000)]);
    expect(lineas).toEqual([
      { productoId: 'p1', descripcion: 'Etiquetas adhesivas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000 },
      { descripcion: 'Diseño', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5_000 },
    ]);
  });

  it('reconoce cuando las filas son las mismas que las guardadas y cuando cambió algo', () => {
    const filas = [filaDeLineaGuardada(guardada(0), 'g0')];
    expect(mismasQueLasGuardadas(filas, [guardada(0)])).toBe(true);
    expect(mismasQueLasGuardadas([filaConCantidad(filas[0]!, 200_000)], [guardada(0)])).toBe(false);
    expect(mismasQueLasGuardadas([], [guardada(0)])).toBe(false);
  });

  it('la clave siguiente no repite las existentes', () => {
    expect(claveSiguiente([])).toBe('n1');
    expect(claveSiguiente([filaDeProductoVacia('g3'), filaDeProductoVacia('n7')])).toBe('n8');
  });
});
