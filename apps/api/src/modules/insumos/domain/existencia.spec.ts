import { describe, expect, it } from 'vitest';
import { aplicarMovimiento, estaBajoMinimo, mensajeDeFaltante, movimientoDeAjuste, movimientoManual, textoDeCantidad } from './existencia.js';

describe('movimiento con signo', () => {
  it('la entrada suma y la salida resta', () => {
    expect(movimientoManual('entrada', 2500)).toEqual({ tipo: 'entrada', cantidadMilesimas: 2500 });
    expect(movimientoManual('salida', 2500)).toEqual({ tipo: 'salida', cantidadMilesimas: -2500 });
  });

  it('la cantidad tecleada es un entero mayor que cero', () => {
    for (const malo of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => movimientoManual('entrada', malo), String(malo)).toThrow(RangeError);
    }
  });

  it('el ajuste es la diferencia con lo contado, con su signo; si coincide no hay ajuste', () => {
    expect(movimientoDeAjuste(10_000, 7_500)).toEqual({ tipo: 'ajuste', cantidadMilesimas: -2_500 });
    expect(movimientoDeAjuste(0, 4_000)).toEqual({ tipo: 'ajuste', cantidadMilesimas: 4_000 });
    expect(movimientoDeAjuste(3_000, 3_000)).toBeNull();
    expect(() => movimientoDeAjuste(3_000, -1)).toThrow(RangeError);
  });
});

describe('la existencia nunca queda negativa', () => {
  it('una salida mayor a lo que hay se rechaza con lo disponible y el faltante', () => {
    expect(aplicarMovimiento(3_500, movimientoManual('salida', 5_000), 0)).toEqual({ ok: false, disponibleMilesimas: 3_500, faltanteMilesimas: 1_500 });
    expect(aplicarMovimiento(0, movimientoManual('salida', 1), 0)).toEqual({ ok: false, disponibleMilesimas: 0, faltanteMilesimas: 1 });
  });

  it('sacar exactamente lo que hay deja cero', () => {
    expect(aplicarMovimiento(3_500, movimientoManual('salida', 3_500), 0)).toMatchObject({ ok: true, resultanteMilesimas: 0 });
  });

  it('el mensaje del faltante dice cuánto hay y cuánto falta, con la unidad', () => {
    const f = aplicarMovimiento(3_500, movimientoManual('salida', 5_000), 0);
    if (f.ok) throw new Error('debía faltar');
    expect(mensajeDeFaltante(f, 'kg')).toBe('No alcanza: hay 3.5 kg y faltan 1.5 kg.');
  });
});

describe('alerta de bajo mínimo: solo al cruzar hacia abajo', () => {
  const minimo = 10_000;
  it('bajo mínimo es estrictamente menor; con mínimo cero nunca', () => {
    expect(estaBajoMinimo(9_999, minimo)).toBe(true);
    expect(estaBajoMinimo(10_000, minimo)).toBe(false);
    expect(estaBajoMinimo(0, 0)).toBe(false);
  });

  it('de 12 a 8 cruza; de 10 a 9 cruza (10 no estaba bajo)', () => {
    expect(aplicarMovimiento(12_000, movimientoManual('salida', 4_000), minimo)).toEqual({ ok: true, resultanteMilesimas: 8_000, bajoMinimo: true, cruzaMinimo: true });
    expect(aplicarMovimiento(10_000, movimientoManual('salida', 1_000), minimo)).toMatchObject({ cruzaMinimo: true });
  });

  it('ya estando bajo, otra salida no vuelve a avisar', () => {
    expect(aplicarMovimiento(8_000, movimientoManual('salida', 1_000), minimo)).toEqual({ ok: true, resultanteMilesimas: 7_000, bajoMinimo: true, cruzaMinimo: false });
  });

  it('una entrada nunca cruza hacia abajo, aunque quede bajo el mínimo', () => {
    expect(aplicarMovimiento(2_000, movimientoManual('entrada', 1_000), minimo)).toEqual({ ok: true, resultanteMilesimas: 3_000, bajoMinimo: true, cruzaMinimo: false });
  });

  it('quedar justo en el mínimo no es bajo mínimo', () => {
    expect(aplicarMovimiento(15_000, movimientoManual('salida', 5_000), minimo)).toMatchObject({ bajoMinimo: false, cruzaMinimo: false });
  });

  it('un ajuste a la baja también cruza; volver a subir y bajar avisa de nuevo', () => {
    expect(aplicarMovimiento(12_000, movimientoDeAjuste(12_000, 4_000)!, minimo)).toMatchObject({ cruzaMinimo: true });
    const subida = aplicarMovimiento(4_000, movimientoManual('entrada', 8_000), minimo);
    expect(subida).toMatchObject({ resultanteMilesimas: 12_000, bajoMinimo: false });
    expect(aplicarMovimiento(12_000, movimientoManual('salida', 3_000), minimo)).toMatchObject({ cruzaMinimo: true });
  });
});

describe('textoDeCantidad', () => {
  it('sin ceros sobrantes, con miles y unidad', () => {
    expect(textoDeCantidad(12_000)).toBe('12');
    expect(textoDeCantidad(12_500, 'kg')).toBe('12.5 kg');
    expect(textoDeCantidad(1_234_567)).toBe('1,234.567');
    expect(textoDeCantidad(-2_500, ' m ')).toBe('-2.5 m');
    expect(textoDeCantidad(0, 'hojas')).toBe('0 hojas');
  });
});
