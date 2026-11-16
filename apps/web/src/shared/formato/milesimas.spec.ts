import { describe, expect, it } from 'vitest';
import { formatearCantidad, milesimasATexto, textoAMilesimas } from './milesimas.ts';

describe('textoAMilesimas', () => {
  it('convierte enteros y decimales', () => {
    expect(textoAMilesimas('12')).toBe(12000);
    expect(textoAMilesimas('12.5')).toBe(12500);
    expect(textoAMilesimas('0.001')).toBe(1);
    expect(textoAMilesimas('S/ 1,234.505')).toBe(1234505);
  });
  it('rechaza lo inválido y lo vacío', () => {
    for (const t of ['', '  ', 'abc', '-1', '1.2345', '1.', '.5', '1e3']) expect(textoAMilesimas(t)).toBeNull();
    expect(textoAMilesimas('99999999999999999')).toBeNull();
  });
});

describe('milesimasATexto', () => {
  it('muestra dos decimales y tres solo si hacen falta', () => {
    expect(milesimasATexto(12500)).toBe('12.50');
    expect(milesimasATexto(12505)).toBe('12.505');
    expect(milesimasATexto(0)).toBe('0.00');
    expect(milesimasATexto(1234567)).toBe('1,234.567');
  });
  it('ida y vuelta', () => {
    expect(textoAMilesimas(milesimasATexto(987654))).toBe(987654);
  });
});

describe('formatearCantidad', () => {
  it('quita ceros sobrantes y agrega la unidad', () => {
    expect(formatearCantidad(12000)).toBe('12');
    expect(formatearCantidad(12500, 'm')).toBe('12.5 m');
    expect(formatearCantidad(1234567, 'kg')).toBe('1,234.567 kg');
    expect(formatearCantidad(0)).toBe('0');
    expect(formatearCantidad(3000, '  ')).toBe('3');
  });
});
