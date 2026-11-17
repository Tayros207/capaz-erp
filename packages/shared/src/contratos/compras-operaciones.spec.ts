import { describe, expect, it } from 'vitest';
import { conciliarFactura } from './compras-operaciones.js';

const base = { moneda: 'PEN' as const };

describe('conciliarFactura', () => {
  it('sin orden no concilia', () => {
    expect(conciliarFactura({ ...base, totalCentimos: 1000, ordenTotalCentimos: null, recibidoCentimos: null }).estado).toBe('sin_orden');
  });
  it('coincide con la orden dentro de la tolerancia', () => {
    expect(conciliarFactura({ ...base, totalCentimos: 11_805, ordenTotalCentimos: 11_800, recibidoCentimos: 11_800 })).toMatchObject({ estado: 'coincide', diferenciaConOrdenCentimos: 5 });
  });
  it('difiere si cobra de más o de menos de lo pactado', () => {
    expect(conciliarFactura({ ...base, totalCentimos: 13_000, ordenTotalCentimos: 11_800, recibidoCentimos: 11_800 })).toMatchObject({ estado: 'difiere', diferenciaConOrdenCentimos: 1_200 });
    expect(conciliarFactura({ ...base, totalCentimos: 10_000, ordenTotalCentimos: 11_800, recibidoCentimos: 11_800 }).estado).toBe('difiere');
  });
  it('una recepción parcial facturada por lo recibido también coincide', () => {
    expect(conciliarFactura({ ...base, totalCentimos: 5_900, ordenTotalCentimos: 11_800, recibidoCentimos: 5_900 })).toMatchObject({ estado: 'coincide', diferenciaConRecibidoCentimos: 0 });
  });
  it('facturar algo cuando no se recibió nada difiere', () => {
    expect(conciliarFactura({ ...base, totalCentimos: 5_900, ordenTotalCentimos: 11_800, recibidoCentimos: 0 }).estado).toBe('difiere');
  });
  it('en otra moneda no se compara', () => {
    expect(conciliarFactura({ moneda: 'USD', totalCentimos: 5_000, ordenTotalCentimos: 11_800, recibidoCentimos: 0 })).toMatchObject({ estado: 'otra_moneda', diferenciaConOrdenCentimos: null });
  });
});
