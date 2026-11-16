import { describe, expect, it } from 'vitest';
import { codificarCursor, decodificarCursor } from './cursor.js';

describe('cursor de listados', () => {
  it('ida y vuelta conserva los microsegundos', () => {
    const id = '0192f0c4-7b1e-7000-8000-000000000001';
    const c = codificarCursor('2026-03-01 10:00:00.123456+00', id);
    expect(decodificarCursor(c)).toEqual({ instante: '2026-03-01 10:00:00.123456+00', id });
  });
  it('lo que no tiene la forma es nulo', () => {
    expect(decodificarCursor('no-es-un-cursor')).toBeNull();
    expect(decodificarCursor(Buffer.from('ayer|0192f0c4-7b1e-7000-8000-000000000001').toString('base64url'))).toBeNull();
    expect(decodificarCursor(Buffer.from('2026-03-01|no-uuid').toString('base64url'))).toBeNull();
  });
});
