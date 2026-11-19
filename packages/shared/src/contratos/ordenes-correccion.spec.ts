import { describe, expect, it } from 'vitest';
import { calcularTotalesDePedido } from './ordenes.js';
import { corregirPedidoSchema, corregirVentaSchema, precioConIgvEncima, precioSinIgvIncluido } from './ordenes-correccion.js';

const id = '0192f0c4-7b1e-7000-8000-000000000010';

describe('atajos de importe (los precios incluyen IGV)', () => {
  it('«el IGV debía ir encima»: S/ 100.00 sin IGV pasa a S/ 118.00', () => {
    expect(precioConIgvEncima(100_000, 18)).toBe(118_000);
    expect(calcularTotalesDePedido([{ cantidadMilesimas: 1000, precioUnitarioMilesimas: precioConIgvEncima(100_000, 18), afectoIgv: true }], 18)).toMatchObject({ subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800 });
  });
  it('«se cobró IGV de más»: S/ 118.00 pasa a S/ 100.00', () => {
    expect(precioSinIgvIncluido(118_000, 18)).toBe(100_000);
  });
  it('ida y vuelta y redondeo hacia arriba en la mitad', () => {
    expect(precioSinIgvIncluido(precioConIgvEncima(59_000, 18), 18)).toBe(59_000);
    expect(precioSinIgvIncluido(0, 18)).toBe(0);
    expect(() => precioSinIgvIncluido(-1, 18)).toThrow();
  });
});

describe('contrato de corrección', () => {
  it('exige indicar algo que corregir y el texto con «otro»', () => {
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'igv' }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'otro', fijarTotalCentimos: 5000 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'otro', motivoTexto: 'x', fijarTotalCentimos: 5000 }).success).toBe(true);
  });
  it('el total fijado no puede ser cero y `abonadoCentimos` solo lo acepta pedido_corregir', () => {
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'igv', fijarTotalCentimos: 0 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'igv', fijarTotalCentimos: 5, abonadoCentimos: 1 }).success).toBe(false);
    expect(corregirPedidoSchema.safeParse({ id, motivoCodigo: 'igv', fijarTotalCentimos: 5, abonadoCentimos: 1 }).success).toBe(true);
  });
});
