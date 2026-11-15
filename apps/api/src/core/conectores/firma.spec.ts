import { describe, expect, it } from 'vitest';
import { firmaDeEntrada, firmarEnvio, generarClaveDeApi, hashDeClave, iguales, pareceClaveDeApi } from './firma.js';
import { LimitadorDeFallos } from './limitador.js';

describe('firmas y claves', () => {
  it('la firma de salida cambia con el secreto, la marca y el cuerpo', () => {
    const base = firmarEnvio('s1', 100, '{"a":1}');
    expect(base).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(firmarEnvio('s2', 100, '{"a":1}')).not.toBe(base);
    expect(firmarEnvio('s1', 101, '{"a":1}')).not.toBe(base);
    expect(firmarEnvio('s1', 100, '{"a":2}')).not.toBe(base);
  });

  it('iguales compara de forma exacta, también con largos distintos', () => {
    expect(iguales('abc', 'abc')).toBe(true);
    expect(iguales('abc', 'abd')).toBe(false);
    expect(iguales('abc', 'abcd')).toBe(false);
  });

  it('la clave de API tiene forma fija, es única y solo su hash sirve para buscarla', () => {
    const a = generarClaveDeApi();
    const b = generarClaveDeApi();
    expect(pareceClaveDeApi(a.clave)).toBe(true);
    expect(a.clave).not.toBe(b.clave);
    expect(a.hash).toBe(hashDeClave(a.clave));
    expect(a.hash).not.toContain(a.clave);
    expect(a.clave.startsWith(a.prefijo)).toBe(true);
    expect(pareceClaveDeApi('capaz_corta')).toBe(false);
    expect(firmaDeEntrada(a.hash, 'x')).not.toBe(firmaDeEntrada(b.hash, 'x'));
  });

  it('el limitador bloquea tras el máximo y libera al pasar la ventana', () => {
    let t = 0;
    const l = new LimitadorDeFallos(3, 1000, () => t);
    for (let i = 0; i < 3; i++) l.registrar('ip');
    expect(l.bloqueado('ip')).toBe(true);
    expect(l.bloqueado('otra')).toBe(false);
    t = 1500;
    expect(l.bloqueado('ip')).toBe(false);
  });
});
