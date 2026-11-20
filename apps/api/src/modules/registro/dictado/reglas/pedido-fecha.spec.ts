import { describe, expect, test } from 'vitest';
import { extraerFechaEntrega } from './pedido-fecha.js';

// Un martes, para que «el viernes» sean 3 días y «el martes» sean 7.
const HOY = '2026-08-18';

describe('extraerFechaEntrega (porte literal de SF)', () => {
  test('mañana, pasado mañana y en N días', () => {
    expect(extraerFechaEntrega('volantes 240 para mañana', HOY).fecha).toBe('2026-08-19');
    expect(extraerFechaEntrega('volantes 240 pasado mañana', HOY).fecha).toBe('2026-08-20');
    expect(extraerFechaEntrega('volantes 240, en 3 días', HOY).fecha).toBe('2026-08-21');
  });
  test('un día de la semana siempre va hacia adelante', () => {
    expect(extraerFechaEntrega('volantes 240 para el viernes', HOY).fecha).toBe('2026-08-21');
    expect(extraerFechaEntrega('volantes 240 para el martes', HOY).fecha).toBe('2026-08-25');
  });
  test('saca la fecha del texto para que no acabe siendo un trabajo', () => {
    expect(extraerFechaEntrega('volantes 240 para el viernes', HOY).resto).toBe('volantes 240');
  });
  test('sin fecha, devuelve el texto intacto', () => {
    const r = extraerFechaEntrega('volantes 240', HOY);
    expect(r.fecha).toBe('');
    expect(r.resto).toBe('volantes 240');
  });
});

describe('extraerFechaEntrega (casos nuevos)', () => {
  test.each([
    ['2026-09-03', 'afiches A3, 200 soles, para el 15', '2026-09-15'],
    ['2026-09-03', 'afiches A3, 200 soles, para el 1', '2026-10-01'],
    ['2026-09-03', 'afiches A3, 200 soles, para el 15 de octubre', '2026-10-15'],
    ['2026-09-03', 'volantes 450, entrega en una semana', '2026-09-10'],
    ['2026-09-03', 'volantes 450, entrega en dos semanas', '2026-09-17'],
    ['2026-02-10', 'volantes 450, para el 31', ''],
    ['2026-11-18', 'volantes, entrega el 15 de marzo', '2027-03-15'],
  ])('%s · %s', (hoy, entrada, fecha) => expect(extraerFechaEntrega(entrada, hoy).fecha).toBe(fecha));
});
