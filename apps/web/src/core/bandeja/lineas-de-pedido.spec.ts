import { describe, expect, it } from 'vitest';
import {
  cuadraFila,
  erroresDeFila,
  esListaDeLineas,
  filaConCantidad,
  filaConPrecio,
  filaConSubtotal,
  filaDeLinea,
  filasDeLineas,
  lineaDeFila,
  lineasDeFilas,
  motivoDePedidoIncompleto,
  subtotalDeFila,
  textoDeLinea,
  totalDeFilas,
} from './lineas-de-pedido.ts';

const tarjetas = { descripcion: 'tarjetas', unidad: 'unidad', cantidadMilesimas: 500000, precioUnitarioMilesimas: 365 };
const volantes = { descripcion: 'millar de volantes', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 240000 };

describe('ida y vuelta', () => {
  it('devuelve la línea igual', () => {
    expect(lineasDeFilas(filasDeLineas([tarjetas]))).toEqual([tarjetas]);
    expect(Object.keys(lineasDeFilas(filasDeLineas([tarjetas]))[0] ?? {})).toEqual(Object.keys(tarjetas));
  });
  it('conserva productoId y afectoIgv', () => {
    const l = { ...tarjetas, productoId: 'p1', afectoIgv: false };
    expect(lineaDeFila(filaDeLinea(l, 'a'))).toEqual(l);
  });
});

describe('subtotales', () => {
  it('por fila y total', () => {
    const filas = filasDeLineas([tarjetas, volantes]);
    expect(filas.map(subtotalDeFila)).toEqual([18250, 24000]);
    expect(totalDeFilas(filas)).toBe(42250);
  });
  it('una fila sin precio no tiene subtotal ni total', () => {
    const { precioUnitarioMilesimas: _p, ...sinPrecio } = tarjetas;
    const filas = filasDeLineas([sinPrecio]);
    expect(subtotalDeFila(filas[0]!)).toBeNull();
    expect(totalDeFilas(filas)).toBeNull();
    expect(erroresDeFila(filas[0]!)).toEqual({ precio: 'Falta el precio.' });
    expect('precioUnitarioMilesimas' in lineaDeFila(filas[0]!)).toBe(false);
  });
});

describe('lo último escrito manda', () => {
  const base = filaDeLinea(tarjetas, 'a');
  it('el subtotal reparte el unitario', () => {
    const f = filaConSubtotal(base, 18250);
    expect(f.precioUnitarioMilesimas).toBe(365);
    expect(subtotalDeFila(f)).toBe(18250);
  });
  it('trabajo entero y luego otra cantidad', () => {
    const f = filaConSubtotal({ ...base, cantidadMilesimas: 1000 }, 24000);
    expect(f.precioUnitarioMilesimas).toBe(240000);
    const g = filaConCantidad(f, 2000);
    expect(g.precioUnitarioMilesimas).toBe(120000);
    expect(subtotalDeFila(g)).toBe(24000);
  });
  it('si manda el precio, cambiar la cantidad cambia el subtotal', () => {
    expect(subtotalDeFila(filaConCantidad(base, 1000000))).toBe(36500);
  });
  it('un subtotal que no cuadra', () => {
    const f = filaConSubtotal({ ...base, cantidadMilesimas: 1500000 }, 100);
    expect(f.precioUnitarioMilesimas).toBe(1);
    expect(subtotalDeFila(f)).toBe(150);
    expect(cuadraFila(f)).toBe(false);
  });
  it('escribir el precio devuelve el mando', () => {
    const f = filaConPrecio(filaConSubtotal(base, 18250), 400);
    expect(f.manda).toBe('precio');
    expect(f.importeEscritoCentimos).toBeNull();
  });
});

describe('motivoDePedidoIncompleto', () => {
  it('dice qué falta, en orden', () => {
    expect(motivoDePedidoIncompleto({ clienteId: null, lineas: [tarjetas] })).toBe('Elige el cliente.');
    expect(motivoDePedidoIncompleto({ clienteId: 'c1', lineas: [] })).toBe('Agrega al menos una línea.');
    const { precioUnitarioMilesimas: _p, ...sinPrecio } = tarjetas;
    expect(motivoDePedidoIncompleto({ clienteId: 'c1', lineas: [sinPrecio] })).toBe('Línea 1: Falta el precio.');
    expect(motivoDePedidoIncompleto({ clienteId: 'c1', lineas: [tarjetas] })).toBeNull();
  });
});

describe('textoDeLinea', () => {
  it('con y sin precio', () => {
    expect(textoDeLinea(tarjetas)).toBe('tarjetas — 500 unidad × S/ 0.365 = S/ 182.50');
    expect(textoDeLinea(volantes)).toBe('millar de volantes — 1 unidad × S/ 240.00 = S/ 240.00');
    expect(textoDeLinea({ descripcion: 'volantes A5', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 59000 })).toBe('volantes A5 — 2 millar × S/ 59.00 = S/ 118.00');
    expect(textoDeLinea({ descripcion: 'volantes', unidad: 'unidad', cantidadMilesimas: 500000 })).toBe('volantes — 500 unidad — sin precio');
  });
});

describe('esListaDeLineas', () => {
  it('reconoce listas de líneas', () => {
    expect(esListaDeLineas([])).toBe(true);
    expect(esListaDeLineas([{ cantidadMilesimas: 1000 }])).toBe(true);
    expect(esListaDeLineas([1])).toBe(false);
    expect(esListaDeLineas('x')).toBe(false);
    expect(esListaDeLineas([{ cantidadMilesimas: '1' }])).toBe(false);
  });
});
