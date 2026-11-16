import { describe, expect, test } from 'vitest';
import { pistaDeDictadoIncompleto } from './reglas/pista.js';

// Una prueba por rama de pista.ts (archivo portado sin pruebas en el origen).
describe('pistaDeDictadoIncompleto', () => {
  test('«trato» sugiere «contrato»', () => {
    expect(pistaDeDictadoIncompleto('trato')).toContain('¿Quisiste decir "contrato"?');
  });
  test('un contrato o trabajo sin monto', () => {
    expect(pistaDeDictadoIncompleto('anota un pedido de tarjetas')).toContain('Entiendo un contrato o trabajo');
  });
  test('ingreso sin monto', () => {
    expect(pistaDeDictadoIncompleto('me pagaron de Juan')).toContain('¿Cuánto fue el ingreso?');
  });
  test('egreso sin monto', () => {
    expect(pistaDeDictadoIncompleto('compré tinta')).toContain('¿Cuánto fue el egreso?');
  });
  test('abono sin monto', () => {
    expect(pistaDeDictadoIncompleto('adelanto de Cristina')).toContain('¿Cuánto abonó?');
  });
  test('cualquier otra frase', () => {
    expect(pistaDeDictadoIncompleto('hola que tal')).toContain('No detecté el monto');
  });
});
