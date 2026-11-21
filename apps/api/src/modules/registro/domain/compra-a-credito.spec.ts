import { describe, expect, it } from 'vitest';
import { diaParaResumen, vencimientoDeCompra } from './compra-a-credito.js';

describe('vencimientoDeCompra', () => {
  it('suma el plazo al día de la recepción, también cruzando mes y año', () => {
    expect(vencimientoDeCompra('2026-11-20', 30)).toBe('2026-12-20');
    expect(vencimientoDeCompra('2026-12-15', 30)).toBe('2027-01-14');
    expect(vencimientoDeCompra('2026-01-31', 1)).toBe('2026-02-01');
  });
  it('sin ficha, con cero días o con un plazo inválido no hay vencimiento', () => {
    expect(vencimientoDeCompra('2026-11-20', null)).toBeNull();
    expect(vencimientoDeCompra('2026-11-20', undefined)).toBeNull();
    expect(vencimientoDeCompra('2026-11-20', 0)).toBeNull();
    expect(vencimientoDeCompra('2026-11-20', -5)).toBeNull();
    expect(vencimientoDeCompra('2026-11-20', 7.5)).toBeNull();
  });
  it('el día del resumen va como DD/MM/AAAA', () => {
    expect(diaParaResumen('2026-12-20')).toBe('20/12/2026');
  });
});
