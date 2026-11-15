import { describe, expect, it } from 'vitest';
import { esCorreoValido, hayErrores, validarEmpresa, validarInicio, validarRegistro } from './validacion.ts';

describe('validación de acceso', () => {
  it('reconoce correos', () => {
    expect(esCorreoValido(' ana@empresa.pe ')).toBe(true);
    expect(esCorreoValido('ana@empresa')).toBe(false);
    expect(esCorreoValido('ana empresa.pe')).toBe(false);
  });

  it('inicio: pide correo y contraseña', () => {
    expect(validarInicio({ correo: '', clave: '' })).toEqual({ correo: 'Escribe tu correo.', clave: 'Escribe tu contraseña.' });
    expect(hayErrores(validarInicio({ correo: 'a@b.pe', clave: 'x' }))).toBe(false);
  });

  it('registro: nombre, correo y contraseña de 10 a 128', () => {
    const e = validarRegistro({ nombre: 'A', correo: 'mal', clave: 'corta' });
    expect(Object.keys(e)).toEqual(['nombre', 'correo', 'clave']);
    expect(validarRegistro({ nombre: 'Ana', correo: 'a@b.pe', clave: '1234567890' })).toEqual({});
    expect(validarRegistro({ nombre: 'Ana', correo: 'a@b.pe', clave: 'x'.repeat(129) }).clave).toMatch(/128/);
  });

  it('empresa: de 2 a 80 letras sin contar espacios de los bordes', () => {
    expect(validarEmpresa(' a ').nombre).toBeDefined();
    expect(validarEmpresa('Imprenta Sol')).toEqual({});
    expect(validarEmpresa('x'.repeat(81)).nombre).toMatch(/80/);
  });
});
