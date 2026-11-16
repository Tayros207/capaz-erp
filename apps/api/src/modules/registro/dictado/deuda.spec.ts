import { describe, expect, test } from 'vitest';
import { tipoDeDeudaDictada } from './deuda.js';

describe('tipoDeDeudaDictada (regla nueva, no portada)', () => {
  test.each([
    'Juan me debe 350 por un banner',
    'Cristina me quedó debiendo 240',
    'le fié 120 a Rosa',
    'me quedan debiendo 500',
  ])('por cobrar: %s', (frase) => {
    expect(tipoDeDeudaDictada(frase)).toBe('por_cobrar');
  });

  test.each([
    'le debo a Pacheco 500 de papel',
    'quedé debiendo 200 en la distribuidora',
    'me fiaron 300 de tinta',
    'debo 150 al técnico',
  ])('por pagar: %s', (frase) => {
    expect(tipoDeDeudaDictada(frase)).toBe('por_pagar');
  });

  test.each(['Ingreso 500 soles, cliente Juan, flyers', 'pagué la luz 180'])('sin deuda: %s', (frase) => {
    expect(tipoDeDeudaDictada(frase)).toBeNull();
  });

  test('«me dio 80 de lo que me debe» devuelve por_cobrar (interpretarDictado no la llama: es abono)', () => {
    expect(tipoDeDeudaDictada('me dio 80 de lo que me debe')).toBe('por_cobrar');
  });
});
