import { describe, expect, it } from 'vitest';
import { descripcionDeDiferencia, diferenciaDe, estadoDeSemana, explicacionSuficiente, movimientoDeDiferencia, textoDeDiferencia } from './cierre.js';

describe('explicacionSuficiente', () => {
  it('14 caracteres no alcanzan y 15 sí', () => {
    expect(explicacionSuficiente('a'.repeat(14))).toBe(false);
    expect(explicacionSuficiente('a'.repeat(15))).toBe(true);
  });
  it('los espacios de los extremos no cuentan', () => {
    expect(explicacionSuficiente(`   ${'a'.repeat(14)}   `)).toBe(false);
    expect(explicacionSuficiente(undefined)).toBe(false);
  });
});

describe('movimientoDeDiferencia', () => {
  it('sobrante es ingreso, faltante es egreso y cero no crea nada', () => {
    expect(movimientoDeDiferencia(diferenciaDe(10_000, 10_500))).toEqual({ tipo: 'ingreso', montoCentimos: 500 });
    expect(movimientoDeDiferencia(diferenciaDe(10_000, 9_000))).toEqual({ tipo: 'egreso', montoCentimos: 1_000 });
    expect(movimientoDeDiferencia(0)).toBeNull();
  });
  it('dice faltan o sobran', () => {
    expect(textoDeDiferencia(-1_050)).toBe('Faltan S/ 10.50');
    expect(textoDeDiferencia(300)).toBe('Sobran S/ 3.00');
  });
});

describe('descripcionDeDiferencia', () => {
  it('lleva la semana y se corta a 500', () => {
    expect(descripcionDeDiferencia('2026-11-16', '2026-11-21', ' Billete falso ')).toBe('Diferencia de caja · semana 16/11 al 21/11: Billete falso');
    expect(descripcionDeDiferencia('2026-11-16', '2026-11-21', 'x'.repeat(600))).toHaveLength(500);
  });
});

describe('estadoDeSemana', () => {
  const semana = { desde: '2026-11-16', hasta: '2026-11-21' };
  it.each([
    ['2026-11-15', false, 'futura'],
    ['2026-11-18', false, 'en_curso'],
    ['2026-11-21', false, 'por_cerrar'],
    ['2026-11-30', false, 'por_cerrar'],
    ['2026-11-30', true, 'cerrada'],
  ])('hoy %s cerrada=%s es %s', (hoy, cerrada, esperado) => {
    expect(estadoDeSemana(semana, hoy, cerrada)).toBe(esperado);
  });
});
