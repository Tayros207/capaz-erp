import { describe, expect, it } from 'vitest';
import { aCentimos } from '@capaz/shared';
import { formatearFecha, formatearFechaHora, formatearHora } from './fechas.ts';
import { centimosATexto, formatearSoles, textoACentimos } from './soles.ts';

// 15/11/2026 03:30 UTC = 14/11/2026 22:30 en Lima (UTC-5, sin horario de verano).
const INSTANTE = '2026-11-15T03:30:00Z';

describe('fechas', () => {
  it('usa la zona de la empresa', () => {
    expect(formatearFecha(INSTANTE)).toBe('14/11/2026');
    expect(formatearHora(INSTANTE)).toBe('22:30');
    expect(formatearFechaHora(INSTANTE)).toBe('14/11/2026 22:30');
    expect(formatearFecha(INSTANTE, 'UTC')).toBe('15/11/2026');
    expect(formatearHora(INSTANTE, 'UTC')).toBe('03:30');
  });

  it('acepta Date y marca lo inválido', () => {
    expect(formatearFecha(new Date(INSTANTE))).toBe('14/11/2026');
    expect(formatearFecha('no es fecha')).toBe('—');
    expect(formatearFechaHora('no es fecha')).toBe('—');
  });
});

describe('soles', () => {
  it('formatearSoles es el de shared', () => {
    expect(formatearSoles(aCentimos('1234.5'))).toBe('S/ 1,234.50');
  });

  it('centimosATexto quita el símbolo', () => {
    expect(centimosATexto(aCentimos('1234.5'))).toBe('1,234.50');
    expect(centimosATexto(aCentimos('-3'))).toBe('-3.00');
  });

  it('textoACentimos entiende lo que escribe la gente', () => {
    expect(textoACentimos('1234.50')).toBe(123450);
    expect(textoACentimos('S/ 1,234.5')).toBe(123450);
    expect(textoACentimos(' 10 ')).toBe(1000);
    expect(textoACentimos('-2.25')).toBe(-225);
    expect(textoACentimos('')).toBeNull();
    expect(textoACentimos('abc')).toBeNull();
    expect(textoACentimos('1.234')).toBeNull();
  });
});
