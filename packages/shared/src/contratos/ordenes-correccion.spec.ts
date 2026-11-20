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
  it('ida y vuelta en todo el rango: sin IGV(con IGV(p)) = p exacto; con IGV(sin IGV(p)) se aleja a lo más 1 milésima', () => {
    for (let p = 0; p <= 200_000; p += 7) {
      expect(precioSinIgvIncluido(precioConIgvEncima(p, 18), 18)).toBe(p);
      expect(Math.abs(precioConIgvEncima(precioSinIgvIncluido(p, 18), 18) - p)).toBeLessThanOrEqual(1);
    }
    // Precio de tres decimales: S/ 0.085 más IGV es S/ 0.1003, que se guarda como S/ 0.100 (la milésima es el tope del precio).
    expect(precioConIgvEncima(85, 18)).toBe(100);
    expect(() => precioConIgvEncima(Number.MAX_SAFE_INTEGER + 1, 18)).toThrow();
  });
});

describe('contrato de corrección', () => {
  it('exige indicar algo que corregir y el texto con «otro»', () => {
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'igv' }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'otro', fijarTotalCentimos: 5000 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'otro', motivoTexto: 'x', fijarTotalCentimos: 5000 }).success).toBe(true);
  });
  it('exige la versión que se corrige (dos personas a la vez no se pisan)', () => {
    expect(corregirVentaSchema.safeParse({ id, motivoCodigo: 'igv', fijarTotalCentimos: 5000 }).success).toBe(false);
    expect(corregirPedidoSchema.safeParse({ id, motivoCodigo: 'igv', fijarTotalCentimos: 5000 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 0, motivoCodigo: 'igv', fijarTotalCentimos: 5000 }).success).toBe(false);
  });
  it('el total fijado no puede ser cero y lo abonado nunca es un argumento (ni en pedido_corregir)', () => {
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'igv', fijarTotalCentimos: 0 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'igv', fijarTotalCentimos: 5, abonadoCentimos: 1 }).success).toBe(false);
    expect(corregirPedidoSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'igv', fijarTotalCentimos: 5, abonadoCentimos: 0 }).success).toBe(false);
  });
  it('motivo de hasta 300 caracteres', () => {
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'otro', motivoTexto: 'x'.repeat(301), fijarTotalCentimos: 5 }).success).toBe(false);
    expect(corregirVentaSchema.safeParse({ id, versionEsperada: 1, motivoCodigo: 'otro', motivoTexto: '<script>alert(1)</script>', fijarTotalCentimos: 5 }).success).toBe(true);
  });
});
