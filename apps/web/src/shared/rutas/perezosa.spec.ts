import { describe, expect, it, vi } from 'vitest';
import { perezosa } from './perezosa.ts';

describe('perezosa', () => {
  it('no carga nada al declarar la ruta', () => {
    const cargar = vi.fn(async () => ({ Pantalla: 'x' }));
    perezosa(cargar, (m) => m.Pantalla);
    expect(cargar).not.toHaveBeenCalled();
  });

  it('carga al llamarla y arma el elemento con lo que exporta el módulo', async () => {
    const cargar = vi.fn(async () => ({ Pantalla: 'pantalla-a' }));
    const lazy = perezosa(cargar, (m) => m.Pantalla);
    await expect(lazy()).resolves.toEqual({ element: 'pantalla-a' });
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('propaga el error de la carga para que la ruta pueda reintentar', async () => {
    const lazy = perezosa(async () => { throw new Error('trozo viejo'); }, () => null);
    await expect(lazy()).rejects.toThrow('trozo viejo');
  });
});
