import { describe, expect, it } from 'vitest';
import { debeRecargar } from './recarga-tras-despliegue.ts';

describe('debeRecargar', () => {
  it('recarga si nunca se recargó', () => {
    expect(debeRecargar(null, 1_000_000)).toBe(true);
  });

  it('no recarga si la última recarga fue hace menos de un minuto', () => {
    expect(debeRecargar(1_000_000, 1_030_000)).toBe(false);
  });

  it('recarga si pasó más de un minuto', () => {
    expect(debeRecargar(1_000_000, 1_061_000)).toBe(true);
  });

  it('un valor guardado ilegible cuenta como nunca recargado', () => {
    expect(debeRecargar(Number.NaN, 1_000_000)).toBe(true);
  });
});
