import { describe, expect, it } from 'vitest';
import { avisoDeErrorDeVoz, recortarTexto, unirConBase, unirResultados, unirSesion, type ListaDeResultados } from './logica-reconocedor.ts';

const r = (...items: Array<[string, boolean]>): ListaDeResultados =>
  Object.assign(items.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })), {}) as unknown as ListaDeResultados;

describe('unirResultados', () => {
  it('en continuo concatena todo', () => {
    expect(unirResultados(r(['ingreso ', true], ['500 soles', false]), true)).toBe('ingreso 500 soles');
  });
  it('por sesiones une finales y el último parcial', () => {
    expect(unirResultados(r(['ingreso 500', true], ['soles', false]), false)).toBe('ingreso 500 soles');
  });
  it('no repite el parcial si ya está al final', () => {
    expect(unirResultados(r(['ingreso 500 soles', true], ['soles', false]), false)).toBe('ingreso 500 soles');
  });
  it('sin parcial devuelve los finales', () => {
    expect(unirResultados(r(['hola', true]), false)).toBe('hola');
  });
});

describe('unirSesion', () => {
  it('une sin repetir la cola', () => {
    expect(unirSesion('ingreso 500', 'ingreso 500 soles')).toBe('ingreso 500 soles');
    expect(unirSesion('ingreso 500 soles', 'soles cliente Juan')).toBe('ingreso 500 soles cliente Juan');
  });
  it('si no hay solapamiento, separa con espacio', () => {
    expect(unirSesion('hola', 'mundo')).toBe('hola mundo');
  });
  it('maneja vacíos', () => {
    expect(unirSesion('', ' a ')).toBe('a');
    expect(unirSesion('a', '')).toBe('a');
  });
});

describe('recorte y base', () => {
  it('recorta al máximo', () => {
    expect(recortarTexto('x'.repeat(600))).toHaveLength(500);
    expect(recortarTexto('abcdef', 3)).toBe('abc');
  });
  it('une lo dictado a lo escrito', () => {
    expect(unirConBase('egreso ', 'luz 80')).toBe('egreso luz 80');
    expect(unirConBase('', ' luz 80 ')).toBe('luz 80');
    expect(unirConBase('a'.repeat(499), 'bbb')).toHaveLength(500);
  });
});

describe('avisos de error de voz', () => {
  it('traduce los códigos conocidos', () => {
    expect(avisoDeErrorDeVoz('network', false)).toMatch(/internet/);
    expect(avisoDeErrorDeVoz('not-allowed', true)).toMatch(/Chrome/);
    expect(avisoDeErrorDeVoz('otro', false)).toBeNull();
  });
});
