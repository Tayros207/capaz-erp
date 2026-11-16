import { describe, expect, it } from 'vitest';
import {
  aplicarAbono,
  estaVencida,
  estadoDeDeuda,
  puedeAnularseLaDeuda,
  puedeEditarseLaDeuda,
  revertirAbono,
  saldoDeDeuda,
  tipoDeMovimientoDeAbono,
  validarVencimiento,
  type SaldoDeDeuda,
} from './deuda.js';

const deuda = (abonadoCentimos = 0, totalCentimos = 10_000, estado?: SaldoDeDeuda['estado']): SaldoDeDeuda => ({
  totalCentimos,
  abonadoCentimos,
  estado: estado ?? estadoDeDeuda(totalCentimos, abonadoCentimos),
});

describe('estado y saldo de una deuda (regla 2)', () => {
  it('pendiente, parcial y pagada según lo abonado', () => {
    expect(estadoDeDeuda(10_000, 0)).toBe('pendiente');
    expect(estadoDeDeuda(10_000, 1)).toBe('parcial');
    expect(estadoDeDeuda(10_000, 9_999)).toBe('parcial');
    expect(estadoDeDeuda(10_000, 10_000)).toBe('pagada');
  });

  it('saldo = total − abonado', () => {
    expect(saldoDeDeuda(10_000, 0)).toBe(10_000);
    expect(saldoDeDeuda(10_000, 3_000)).toBe(7_000);
    expect(saldoDeDeuda(10_000, 10_000)).toBe(0);
  });

  it('no acepta importes imposibles ni decimales', () => {
    expect(() => estadoDeDeuda(10_000, -1)).toThrow(RangeError);
    expect(() => estadoDeDeuda(10_000, 10_001)).toThrow(RangeError);
    expect(() => estadoDeDeuda(0, 0)).toThrow(RangeError);
    expect(() => estadoDeDeuda(100.5, 0)).toThrow(RangeError);
    expect(() => saldoDeDeuda(10_000, 0.1)).toThrow(RangeError);
  });
});

describe('abonar (regla 3)', () => {
  it('un abono parcial deja la deuda en parcial con el saldo exacto', () => {
    expect(aplicarAbono(deuda(), 3_000)).toEqual({ ok: true, abonadoCentimos: 3_000, saldoCentimos: 7_000, estado: 'parcial', quedaPagada: false });
  });

  it('el abono que completa el total la deja pagada', () => {
    expect(aplicarAbono(deuda(3_000), 7_000)).toEqual({ ok: true, abonadoCentimos: 10_000, saldoCentimos: 0, estado: 'pagada', quedaPagada: true });
  });

  it('un abono mayor que el saldo es conflicto, con los dos importes en el mensaje', () => {
    expect(aplicarAbono(deuda(), 10_001)).toEqual({ ok: false, codigo: 'conflicto', mensaje: 'El abono (S/ 100.01) supera el saldo pendiente (S/ 100.00).' });
    expect(aplicarAbono(deuda(6_000), 6_000)).toMatchObject({ ok: false, codigo: 'conflicto', mensaje: 'El abono (S/ 60.00) supera el saldo pendiente (S/ 40.00).' });
  });

  it('una deuda pagada o anulada no admite abonos', () => {
    expect(aplicarAbono(deuda(10_000), 1)).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(aplicarAbono(deuda(0, 10_000, 'anulada'), 1)).toMatchObject({ ok: false, codigo: 'conflicto' });
  });

  it('el monto debe ser un entero positivo', () => {
    expect(aplicarAbono(deuda(), 0)).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
    expect(aplicarAbono(deuda(), -5)).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
    expect(() => aplicarAbono(deuda(), 10.5)).toThrow(RangeError);
  });

  it('por cobrar entra dinero; por pagar sale', () => {
    expect(tipoDeMovimientoDeAbono('por_cobrar')).toBe('ingreso');
    expect(tipoDeMovimientoDeAbono('por_pagar')).toBe('egreso');
  });
});

describe('anular un abono (regla 4)', () => {
  it('devuelve el monto al saldo y recalcula el estado', () => {
    expect(revertirAbono(deuda(4_000), 4_000)).toEqual({ abonadoCentimos: 0, saldoCentimos: 10_000, estado: 'pendiente' });
    expect(revertirAbono(deuda(10_000), 4_000)).toEqual({ abonadoCentimos: 6_000, saldoCentimos: 4_000, estado: 'parcial' });
  });

  it('nunca deja lo abonado en negativo', () => {
    expect(() => revertirAbono(deuda(3_000), 3_001)).toThrow(RangeError);
    expect(() => revertirAbono(deuda(3_000), 0)).toThrow(RangeError);
  });
});

describe('anular y editar una deuda (regla 5)', () => {
  it('se anula solo sin abonos vivos', () => {
    expect(puedeAnularseLaDeuda(deuda(), 0)).toEqual({ ok: true });
    expect(puedeAnularseLaDeuda(deuda(3_000), 1)).toEqual({ ok: false, codigo: 'conflicto', mensaje: 'Anula primero su abono.' });
    expect(puedeAnularseLaDeuda(deuda(10_000), 3)).toEqual({ ok: false, codigo: 'conflicto', mensaje: 'Anula primero sus 3 abonos.' });
  });

  it('una deuda ya anulada no se vuelve a anular ni se edita', () => {
    expect(puedeAnularseLaDeuda(deuda(0, 10_000, 'anulada'), 0)).toMatchObject({ ok: false, codigo: 'conflicto', mensaje: 'Esa deuda ya está anulada.' });
    expect(puedeEditarseLaDeuda('anulada')).toMatchObject({ ok: false, codigo: 'conflicto' });
    expect(puedeEditarseLaDeuda('pagada')).toEqual({ ok: true });
  });
});

describe('fechas de una deuda (regla 6)', () => {
  it('el vencimiento no puede ser anterior a la fecha', () => {
    expect(validarVencimiento('2026-03-10', null)).toEqual({ ok: true });
    expect(validarVencimiento('2026-03-10', '2026-03-10')).toEqual({ ok: true });
    expect(validarVencimiento('2026-03-10', '2026-03-09')).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });

  it('vencida: abierta y con vencimiento anterior a hoy', () => {
    expect(estaVencida({ estado: 'pendiente', venceEn: '2026-03-09' }, '2026-03-10')).toBe(true);
    expect(estaVencida({ estado: 'parcial', venceEn: '2026-03-09' }, '2026-03-10')).toBe(true);
    expect(estaVencida({ estado: 'pendiente', venceEn: '2026-03-10' }, '2026-03-10')).toBe(false);
    expect(estaVencida({ estado: 'pagada', venceEn: '2026-03-01' }, '2026-03-10')).toBe(false);
    expect(estaVencida({ estado: 'anulada', venceEn: '2026-03-01' }, '2026-03-10')).toBe(false);
    expect(estaVencida({ estado: 'pendiente', venceEn: null }, '2026-03-10')).toBe(false);
  });
});
