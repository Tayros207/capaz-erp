import { describe, expect, it } from 'vitest';
import { mensajeDeValidacion } from './validacion.js';

describe('mensajeDeValidacion', () => {
  it('nombra el campo, no el valor', () => {
    expect(mensajeDeValidacion([{ message: 'Invalid: 12345', path: ['cliente', { key: 'telefono' }] }])).toBe(
      'Dato inválido en «cliente.telefono».',
    );
  });

  it('usa un texto general si no hay ruta', () => {
    expect(mensajeDeValidacion([{ message: 'x' }])).toBe('Los datos enviados no son válidos.');
    expect(mensajeDeValidacion([])).toBe('Los datos enviados no son válidos.');
  });
});
