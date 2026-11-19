import { describe, expect, it } from 'vitest';
import { calcularAjuste } from './ajuste.js';

describe('calcularAjuste', () => {
  it('sube el total sin tocar lo abonado y recalcula el estado', () => {
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 10_000 }, 12_000, 0)).toMatchObject({ ok: true, totalNuevoCentimos: 12_000, montoCentimos: 2_000, aFavorCentimos: 0, estado: 'parcial' });
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 0 }, 8_000, 0)).toMatchObject({ montoCentimos: -2_000, estado: 'pendiente' });
  });
  it('baja hasta lo abonado y queda pagada', () => {
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 6_000 }, 6_000, 0)).toMatchObject({ totalNuevoCentimos: 6_000, aFavorCentimos: 0, estado: 'pagada' });
  });
  it('si el cliente pagó de más, la deuda queda en lo abonado y el exceso a su favor', () => {
    const r = calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 10_000 }, 7_000, 0);
    expect(r).toMatchObject({ ok: true, totalNuevoCentimos: 10_000, montoCentimos: 0, aFavorCentimos: 3_000, estado: 'pagada', sinCambio: false });
    // Invariante: total del pedido = total de la deuda − a favor.
    if (r.ok) expect(r.totalNuevoCentimos - r.aFavorCentimos).toBe(7_000);
  });
  it('un segundo ajuste con el mismo exceso no cambia nada', () => {
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 10_000 }, 7_000, 3_000)).toMatchObject({ sinCambio: true });
  });
  it('total cero o negativo se rechaza: se anula la deuda', () => {
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 0 }, 0, 0)).toMatchObject({ ok: false, mensaje: expect.stringContaining('anúlala') });
    expect(calcularAjuste({ totalCentimos: 10_000, abonadoCentimos: 0 }, -5, 0)).toMatchObject({ ok: false });
  });
});
