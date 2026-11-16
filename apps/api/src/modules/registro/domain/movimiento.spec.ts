import { describe, expect, it } from 'vitest';
import { CATEGORIAS_POR_DEFECTO, CUENTA_POR_DEFECTO, categoriaDeAbono, normalizarNombre } from './catalogos.js';
import { codificarCursorPorFecha, codificarCursorPorInstante, decodificarCursorPorFecha, decodificarCursorPorInstante } from './cursor.js';
import { avisoDeSaldoNegativo, categoriaUtilizable, cuentaUtilizable, fechaDeMovimiento, montoConSigno, puedeAnularseElMovimiento, saldoDeCuenta } from './movimiento.js';

describe('fecha de un movimiento (regla 6)', () => {
  it('por defecto es hoy', () => {
    expect(fechaDeMovimiento(undefined, '2026-03-10')).toEqual({ ok: true, fecha: '2026-03-10' });
  });
  it('acepta hoy y días pasados', () => {
    expect(fechaDeMovimiento('2026-03-10', '2026-03-10')).toEqual({ ok: true, fecha: '2026-03-10' });
    expect(fechaDeMovimiento('2025-12-31', '2026-03-10')).toEqual({ ok: true, fecha: '2025-12-31' });
  });
  it('una fecha futura es argumentos_invalidos', () => {
    expect(fechaDeMovimiento('2026-03-11', '2026-03-10')).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });
});

describe('cuenta y categoría (regla 7)', () => {
  it('una cuenta archivada es conflicto', () => {
    expect(cuentaUtilizable({ nombre: 'Caja', archivadoEn: null })).toEqual({ ok: true });
    expect(cuentaUtilizable({ nombre: 'Caja', archivadoEn: new Date() })).toMatchObject({ ok: false, codigo: 'conflicto' });
  });
  it('la categoría debe ser del tipo del movimiento', () => {
    expect(categoriaUtilizable('ingreso', { nombre: 'Ventas', tipo: 'ingreso', archivadoEn: null })).toEqual({ ok: true });
    expect(categoriaUtilizable('egreso', { nombre: 'Ventas', tipo: 'ingreso', archivadoEn: null })).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
    expect(categoriaUtilizable('ingreso', { nombre: 'Ventas', tipo: 'ingreso', archivadoEn: new Date() })).toMatchObject({ ok: false, codigo: 'conflicto' });
  });
});

describe('anular un movimiento (regla 4)', () => {
  it('solo un movimiento activo', () => {
    expect(puedeAnularseElMovimiento('activo')).toEqual({ ok: true });
    expect(puedeAnularseElMovimiento('anulado')).toEqual({ ok: false, codigo: 'conflicto', mensaje: 'Ese movimiento ya está anulado.' });
  });
});

describe('saldos (reglas 8 y 9)', () => {
  it('saldo = saldo inicial + ingresos − egresos', () => {
    expect(saldoDeCuenta(0, 0, 0)).toBe(0);
    expect(saldoDeCuenta(10_000, 2_550, 1_025)).toBe(11_525);
    expect(saldoDeCuenta(-500, 0, 100)).toBe(-600);
  });
  it('no suma decimales ni totales negativos', () => {
    expect(() => saldoDeCuenta(0.5, 0, 0)).toThrow(RangeError);
    expect(() => saldoDeCuenta(0, -1, 0)).toThrow(RangeError);
    expect(() => saldoDeCuenta(Number.MAX_SAFE_INTEGER, 10, 0)).toThrow(RangeError);
  });
  it('los egresos restan', () => {
    expect(montoConSigno('ingreso', 1_500)).toBe(1_500);
    expect(montoConSigno('egreso', 1_500)).toBe(-1_500);
  });
  it('un egreso que deja la cuenta en negativo avisa; lo demás no', () => {
    expect(avisoDeSaldoNegativo('egreso', 'Caja', -1)).toEqual({ codigo: 'saldo_negativo', nivel: 'comercial', mensaje: 'La cuenta «Caja» queda con saldo negativo.' });
    expect(avisoDeSaldoNegativo('egreso', 'Caja', 0)).toBeNull();
    expect(avisoDeSaldoNegativo('ingreso', 'Caja', -500)).toBeNull();
  });
});

describe('catálogos por defecto (regla 10)', () => {
  it('una cuenta «Caja» y diez categorías con su tipo (dos son la reservada «Transferencia»)', () => {
    expect(CUENTA_POR_DEFECTO).toEqual({ nombre: 'Caja', tipo: 'caja' });
    expect(CATEGORIAS_POR_DEFECTO.filter((c) => c.tipo === 'ingreso').map((c) => c.nombre)).toEqual(['Ventas', 'Cobros', 'Otros ingresos', 'Transferencia']);
    expect(CATEGORIAS_POR_DEFECTO.filter((c) => c.tipo === 'egreso').map((c) => c.nombre)).toEqual(['Compras', 'Pagos', 'Servicios', 'Sueldos', 'Otros egresos', 'Transferencia']);
  });
  it('un abono usa «Cobros» o «Pagos», que están entre las de su tipo', () => {
    expect(categoriaDeAbono('ingreso')).toBe('Cobros');
    expect(categoriaDeAbono('egreso')).toBe('Pagos');
    for (const tipo of ['ingreso', 'egreso'] as const) {
      expect(CATEGORIAS_POR_DEFECTO).toContainEqual({ nombre: categoriaDeAbono(tipo), tipo });
    }
  });
  it('los nombres se comparan sin tildes, mayúsculas ni espacios de más', () => {
    expect(normalizarNombre('  Caja   Chíca ')).toBe('caja chica');
  });
});

describe('cursores', () => {
  const id = '0192f0c4-7b1e-7000-8000-000000000001';
  it('por fecha: ida y vuelta, y rechaza lo que no es suyo', () => {
    expect(decodificarCursorPorFecha(codificarCursorPorFecha({ fecha: '2026-03-10', id }))).toEqual({ fecha: '2026-03-10', id });
    expect(decodificarCursorPorFecha('basura')).toBeNull();
    expect(decodificarCursorPorFecha(Buffer.from(`2026-13-45|${id}`).toString('base64url'))).toBeNull();
    expect(decodificarCursorPorFecha(Buffer.from(`2026-03-10|no-es-un-id`).toString('base64url'))).toBeNull();
    expect(decodificarCursorPorFecha(Buffer.from(`2026-03-10'; drop table x; --|${id}`).toString('base64url'))).toBeNull();
  });
  it('por instante: conserva los microsegundos', () => {
    const instante = '2026-03-10 15:04:05.123456+00';
    expect(decodificarCursorPorInstante(codificarCursorPorInstante({ instante, id }))).toEqual({ instante, id });
    expect(decodificarCursorPorInstante(Buffer.from(`ayer|${id}`).toString('base64url'))).toBeNull();
    expect(decodificarCursorPorInstante('')).toBeNull();
  });
});
