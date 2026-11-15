import { describe, expect, it } from 'vitest';
import { RegistroDeHerramientas } from './registro.js';
import type { HerramientaRegistrada } from './tipos.js';

const h = { nombre: 'clientes_ver' } as HerramientaRegistrada;
// El catálogo no interviene en `agregar`, `obtener` ni `todas`.
const nuevo = () => new RegistroDeHerramientas(undefined as never);

describe('RegistroDeHerramientas', () => {
  it('agrega, obtiene y lista', () => {
    const r = nuevo();
    r.agregar([h]);
    expect(r.obtener('clientes_ver')).toBe(h);
    expect(r.obtener('otra')).toBeUndefined();
    expect(r.todas()).toEqual([h]);
  });
  it('lanza si un nombre se repite', () => {
    const r = nuevo();
    r.agregar([h]);
    expect(() => r.agregar([h])).toThrow(/repetida/);
  });
  it('valida al terminar el arranque con los contratos reales (hoy vacíos)', () => {
    const r = new RegistroDeHerramientas({
      manifiestos: [{ codigo: 'core', permisos: [] }],
    } as never);
    expect(() => r.onApplicationBootstrap()).not.toThrow();
  });
});
