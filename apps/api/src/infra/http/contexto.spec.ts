import { describe, expect, it } from 'vitest';
import { conContexto, contextoActual, crearContexto, idDePeticion } from './contexto.js';

describe('idDePeticion', () => {
  it('conserva un id inocuo del cliente', () => {
    expect(idDePeticion('abc-12345_X.y')).toBe('abc-12345_X.y');
  });

  it.each([undefined, '', 'corto', 'con espacios y\nsalto de línea', 'x'.repeat(80)])(
    'genera uno propio para %j',
    (entrada) => {
      const id = idDePeticion(entrada);
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('contexto de petición', () => {
  it('es visible dentro de la llamada y se aísla entre llamadas', async () => {
    const lectura = (id: string) =>
      conContexto(crearContexto(id), async () => {
        await new Promise((r) => setTimeout(r, 5));
        return contextoActual()?.requestId;
      });
    expect(await Promise.all([lectura('a'.repeat(8)), lectura('b'.repeat(8))])).toEqual([
      'a'.repeat(8),
      'b'.repeat(8),
    ]);
    expect(contextoActual()).toBeUndefined();
  });

  it('nace sin empresa, usuario ni permisos', () => {
    const c = crearContexto('id-de-prueba');
    expect(c.empresaId).toBeNull();
    expect(c.permisos).toEqual([]);
    expect(c.canal).toBe('ui');
  });
});
