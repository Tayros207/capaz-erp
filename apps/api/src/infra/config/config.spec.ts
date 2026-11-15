import { describe, expect, it } from 'vitest';
import { ConfigInvalida, leerConfig } from './config.js';

const base = {
  DATABASE_URL_APP: 'postgres://u:clave-secreta@localhost:5450/capaz',
  DATABASE_URL_AUTH: 'postgres://a:otra-clave@localhost:5450/capaz',
  DATABASE_URL_SISTEMA: 'postgres://s:clave-de-sistema@localhost:5450/capaz',
  BETTER_AUTH_SECRET: 'a'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  CONFIRMACION_SECRET: 'b'.repeat(32),
};

describe('leerConfig', () => {
  it('acepta lo mínimo y aplica los valores por defecto', () => {
    const c = leerConfig(base);
    expect(c.PORT).toBe(3001);
    expect(c.NODE_ENV).toBe('development');
    expect(c.ALTA_DE_EMPRESAS).toBe('plataforma');
    expect(c.ORIGENES_PERMITIDOS).toEqual(['http://localhost:5173']);
  });

  it('separa varios orígenes por coma', () => {
    const c = leerConfig({ ...base, ORIGENES_PERMITIDOS: 'https://a.pe, https://b.pe' });
    expect(c.ORIGENES_PERMITIDOS).toEqual(['https://a.pe', 'https://b.pe']);
  });

  it('falla si falta una variable y nombra cuál', () => {
    const { BETTER_AUTH_SECRET: _omitida, ...sinSecreto } = base;
    expect(() => leerConfig(sinSecreto)).toThrow(ConfigInvalida);
    expect(() => leerConfig(sinSecreto)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('exige secretos de al menos 32 caracteres', () => {
    expect(() => leerConfig({ ...base, CONFIRMACION_SECRET: 'corto' })).toThrow(/CONFIRMACION_SECRET/);
  });

  it('nunca incluye valores en el mensaje de error', () => {
    try {
      leerConfig({ ...base, DATABASE_URL_APP: 'clave-secreta-no-es-url', BETTER_AUTH_SECRET: 'x' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain('clave-secreta');
    }
  });

  it('rechaza valores fuera de rango o de la lista', () => {
    expect(() => leerConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => leerConfig({ ...base, ALTA_DE_EMPRESAS: 'siempre' })).toThrow(/ALTA_DE_EMPRESAS/);
  });
});
