import { describe, expect, it } from 'vitest';
import { cambiosDeZona, mensajeDeGuardado, zonasDisponibles } from './logica.ts';

describe('pantalla Empresa', () => {
  it('no hay cambio si la zona es la misma o está vacía', () => {
    expect(cambiosDeZona('America/Lima', 'America/Lima')).toBeNull();
    expect(cambiosDeZona('America/Lima', ' ')).toBeNull();
    expect(cambiosDeZona('America/Lima', 'America/Bogota')).toEqual({ zonaHoraria: 'America/Bogota' });
  });

  it('las zonas llevan primero las comunes y siempre incluyen la actual', () => {
    const z = zonasDisponibles('Asia/Tokyo', ['Asia/Tokyo', 'America/Lima', 'Africa/Cairo']);
    expect(z[0]).toBe('America/Lima');
    expect(z).toContain('Asia/Tokyo');
    expect(zonasDisponibles('Raro/Lugar', [])[0]).toBe('Raro/Lugar');
    expect(new Set(z).size).toBe(z.length);
  });

  it('traduce los rechazos conocidos y deja pasar el resto', () => {
    expect(mensajeDeGuardado('sin_permiso', 'x')).toMatch(/permiso/);
    expect(mensajeDeGuardado('otro', 'Texto del servidor')).toBe('Texto del servidor');
  });
});
