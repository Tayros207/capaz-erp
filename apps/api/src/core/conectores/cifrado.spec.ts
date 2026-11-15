import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { Cifrador, CifradoInvalido } from './cifrado.js';

const clave = () => randomBytes(32);
const con = (v: number, k = clave()) => new Cifrador(new Map([[v, k]]), v);

describe('cifrado AES-256-GCM', () => {
  it('ida y vuelta, con un iv distinto cada vez y sin el texto en claro', () => {
    const c = con(1);
    const a = c.cifrar('{"token":"super-secreto"}', 'ctx');
    const b = c.cifrar('{"token":"super-secreto"}', 'ctx');
    expect(a.cifrado).not.toBe(b.cifrado);
    expect(a.cifrado).not.toContain('super-secreto');
    expect(a.cifrado.startsWith('v1.')).toBe(true);
    expect(a.version).toBe(1);
    expect(c.descifrar(a.cifrado, 'ctx')).toBe('{"token":"super-secreto"}');
  });

  it('una clave equivocada no descifra, y el error no revela nada', () => {
    const { cifrado } = con(1).cifrar('secreto', 'ctx');
    const ajeno = con(1);
    expect(() => ajeno.descifrar(cifrado, 'ctx')).toThrow(CifradoInvalido);
    expect(() => ajeno.descifrar(cifrado, 'ctx')).toThrow(/no se pudo descifrar/i);
  });

  it('el contexto va autenticado: un secreto copiado a otra fila no se abre', () => {
    const c = con(1);
    const { cifrado } = c.cifrar('secreto', 'conexion:emp1:x');
    expect(() => c.descifrar(cifrado, 'conexion:emp2:x')).toThrow(CifradoInvalido);
  });

  it('un dato alterado o mal formado se rechaza', () => {
    const c = con(1);
    const { cifrado } = c.cifrar('secreto', 'ctx');
    const partes = cifrado.split('.');
    partes[3] = Buffer.from('otra-cosa-distinta').toString('base64url');
    expect(() => c.descifrar(partes.join('.'), 'ctx')).toThrow(CifradoInvalido);
    expect(() => c.descifrar('basura', 'ctx')).toThrow(/formato/);
  });

  it('la versión viaja con el dato: rotar conserva lo viejo si se entrega la clave anterior', () => {
    const k1 = clave();
    const k2 = clave();
    const viejo = con(1, k1).cifrar('secreto', 'ctx').cifrado;
    const soloNueva = new Cifrador(new Map([[2, k2]]), 2);
    expect(() => soloNueva.descifrar(viejo, 'ctx')).toThrow(/rotó/);
    const ambas = new Cifrador(new Map([[1, k1], [2, k2]]), 2);
    expect(ambas.descifrar(viejo, 'ctx')).toBe('secreto');
    expect(ambas.necesitaRotar(viejo)).toBe(true);
    expect(ambas.necesitaRotar(ambas.cifrar('x', 'ctx').cifrado)).toBe(false);
  });

  it('exige claves de 32 bytes y la de la versión actual', () => {
    expect(() => new Cifrador(new Map([[1, randomBytes(16)]]), 1)).toThrow(CifradoInvalido);
    expect(() => new Cifrador(new Map([[1, clave()]]), 2)).toThrow(CifradoInvalido);
  });

  it('desde la configuración: sin clave no hay cifrador', () => {
    expect(Cifrador.desdeConfig({ CONEXIONES_CLAVE_VERSION: 1 })).toBeNull();
    expect(Cifrador.desdeConfig({ CONEXIONES_CLAVE: clave().toString('base64'), CONEXIONES_CLAVE_VERSION: 3 })?.versionActual).toBe(3);
  });
});
