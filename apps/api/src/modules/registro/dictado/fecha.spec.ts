import { describe, expect, test } from 'vitest';
import { fechaDictada } from './fecha.js';

const HOY = '2026-03-10';

describe('fechaDictada (regla nueva, no portada)', () => {
  test('ayer', () => {
    expect(fechaDictada('ayer pagué la luz 180 soles', HOY)).toBe('2026-03-09');
    expect(fechaDictada('Ayer pagué la luz', HOY)).toBe('2026-03-09');
  });
  test('anteayer, antes de ayer y antier', () => {
    expect(fechaDictada('anteayer le compré a Pacheco 350', HOY)).toBe('2026-03-08');
    expect(fechaDictada('antes de ayer le compré a Pacheco 350', HOY)).toBe('2026-03-08');
    expect(fechaDictada('antier le compré a Pacheco 350', HOY)).toBe('2026-03-08');
  });
  test('hoy, sin fecha y mañana dan null', () => {
    expect(fechaDictada('hoy cobré 300 a Cristina', HOY)).toBeNull();
    expect(fechaDictada('cobré 300 a Cristina', HOY)).toBeNull();
    expect(fechaDictada('mañana pago la luz', HOY)).toBeNull();
  });
  test('«ayer» dentro de otra palabra no cuenta', () => {
    expect(fechaDictada('le pagué a Bayer 200', HOY)).toBeNull();
  });
  test('cruza el mes y el año en UTC', () => {
    expect(fechaDictada('ayer', '2026-03-01')).toBe('2026-02-28');
    expect(fechaDictada('anteayer', '2026-01-01')).toBe('2025-12-30');
    expect(fechaDictada('ayer', '2024-03-01')).toBe('2024-02-29');
  });
  test('un hoy mal formado da null', () => {
    expect(fechaDictada('ayer', 'hoy')).toBeNull();
  });
});
