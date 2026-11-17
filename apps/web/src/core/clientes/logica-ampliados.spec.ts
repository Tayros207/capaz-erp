import { describe, expect, it } from 'vitest';
import { errorDePlazo } from './logica-ampliados.ts';

describe('errorDePlazo', () => {
  it('acepta de 0 a 365 días', () => {
    expect(errorDePlazo('0')).toBeUndefined();
    expect(errorDePlazo(' 30 ')).toBeUndefined();
    expect(errorDePlazo('365')).toBeUndefined();
  });
  it('rechaza lo que no es un entero o pasa de 365', () => {
    expect(errorDePlazo('')).toMatch(/entero/);
    expect(errorDePlazo('1.5')).toMatch(/entero/);
    expect(errorDePlazo('-3')).toMatch(/entero/);
    expect(errorDePlazo('366')).toMatch(/365/);
  });
});
