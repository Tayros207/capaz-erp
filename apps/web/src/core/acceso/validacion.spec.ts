import { describe, expect, it } from 'vitest';
import { esCorreoValido, hayErrores, leerEnlaceDeRestablecer, validarEmpresa, validarInicio, validarNuevaClave, validarRegistro } from './validacion.ts';

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

describe('restablecer contraseña', () => {
  it('pide 10 a 128 caracteres y que coincidan', () => {
    expect(validarNuevaClave({ clave: 'corta', repetir: 'corta' }).clave).toMatch(/al menos 10/);
    expect(validarNuevaClave({ clave: 'x'.repeat(129), repetir: 'x'.repeat(129) }).clave).toMatch(/128/);
    expect(validarNuevaClave({ clave: 'una-clave-larga', repetir: 'otra-distinta' }).repetir).toMatch(/no coinciden/);
    expect(validarNuevaClave({ clave: 'una-clave-larga', repetir: 'una-clave-larga' })).toEqual({});
  });
  it('lee el token del enlace; con error o sin token no sirve', () => {
    expect(leerEnlaceDeRestablecer('?token=abc_DEF-1')).toEqual({ estado: 'valido', token: 'abc_DEF-1' });
    expect(leerEnlaceDeRestablecer('?error=INVALID_TOKEN')).toEqual({ estado: 'invalido' });
    expect(leerEnlaceDeRestablecer('?token=abc&error=INVALID_TOKEN')).toEqual({ estado: 'invalido' });
    expect(leerEnlaceDeRestablecer('')).toEqual({ estado: 'invalido' });
  });
});
