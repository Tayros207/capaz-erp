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

  it('trae los valores por defecto de las variables del relevo y las conexiones', () => {
    const c = leerConfig(base);
    expect(c.RELEVO_ACTIVO).toBe(true);
    expect(c.RELEVO_BARRIDO_SEGUNDOS).toBe(60);
    expect(c.CONEXIONES_CLAVE).toBeUndefined();
    expect(c.CONEXIONES_CLAVE_VERSION).toBe(1);
    expect(c.PERMITIR_DESTINOS_LOCALES).toBe(false);
  });

  it('lee los booleanos escritos como texto', () => {
    const c = leerConfig({ ...base, RELEVO_ACTIVO: 'false', PERMITIR_DESTINOS_LOCALES: 'true' });
    expect(c.RELEVO_ACTIVO).toBe(false);
    expect(c.PERMITIR_DESTINOS_LOCALES).toBe(true);
    expect(() => leerConfig({ ...base, RELEVO_ACTIVO: 'quizá' })).toThrow(/RELEVO_ACTIVO/);
  });

  it('valida el barrido y la versión de la clave', () => {
    expect(leerConfig({ ...base, RELEVO_BARRIDO_SEGUNDOS: '15', CONEXIONES_CLAVE_VERSION: '2' })).toMatchObject({ RELEVO_BARRIDO_SEGUNDOS: 15, CONEXIONES_CLAVE_VERSION: 2 });
    expect(() => leerConfig({ ...base, RELEVO_BARRIDO_SEGUNDOS: '0' })).toThrow(/RELEVO_BARRIDO_SEGUNDOS/);
    expect(() => leerConfig({ ...base, CONEXIONES_CLAVE_VERSION: '0' })).toThrow(/CONEXIONES_CLAVE_VERSION/);
  });

  it('CONEXIONES_CLAVE exige 32 bytes en base64, sin filtrar el valor', () => {
    const buena = Buffer.alloc(32, 7).toString('base64');
    expect(leerConfig({ ...base, CONEXIONES_CLAVE: buena }).CONEXIONES_CLAVE).toBe(buena);
    const corta = Buffer.alloc(16, 7).toString('base64');
    expect(() => leerConfig({ ...base, CONEXIONES_CLAVE: corta })).toThrow(/CONEXIONES_CLAVE/);
    expect(() => leerConfig({ ...base, CONEXIONES_CLAVE: 'no es base64!' })).toThrow(/CONEXIONES_CLAVE/);
    try {
      leerConfig({ ...base, CONEXIONES_CLAVE: corta });
    } catch (e) {
      expect(String(e)).not.toContain(corta);
    }
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

  it('el asistente nace apagado y con valores por defecto, sin obligar a tocar el .env', () => {
    const c = leerConfig(base);
    expect(c.AGENTE_PROVEEDOR).toBe('apagado');
    expect(c.OPENROUTER_API_KEY).toBeUndefined();
    expect(c.AGENTE_MODELO).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(c.AGENTE_RAZONAMIENTO).toBe('none');
    expect(c.AGENTE_TOPE_MENSUAL_USD).toBe(5);
    expect(c.AGENTE_RETENCION_DIAS).toBe(90);
    expect(c.AGENTE_MAX_RONDAS).toBe(12);
    expect(c.AGENTE_ESCRITURA).toBe('activa');
    expect(c.AGENTE_INTERNET).toBe('activa');
    expect(c.AGENTE_WEB_MODELO).toBe('anthropic/claude-sonnet-5.5');
  });

  it('el proveedor simulado se rechaza en producción y se acepta en pruebas', () => {
    expect(() => leerConfig({ ...base, NODE_ENV: 'production', AGENTE_PROVEEDOR: 'simulado' })).toThrow(/AGENTE_PROVEEDOR/);
    expect(leerConfig({ ...base, NODE_ENV: 'test', AGENTE_PROVEEDOR: 'simulado' }).AGENTE_PROVEEDOR).toBe('simulado');
  });

  it('openrouter exige la llave y nunca la filtra en el error', () => {
    expect(() => leerConfig({ ...base, AGENTE_PROVEEDOR: 'openrouter' })).toThrow(/OPENROUTER_API_KEY/);
    expect(leerConfig({ ...base, AGENTE_PROVEEDOR: 'openrouter', OPENROUTER_API_KEY: 'sk-or-secreta' }).AGENTE_PROVEEDOR).toBe('openrouter');
    try {
      leerConfig({ ...base, AGENTE_PROVEEDOR: 'openrouter', AGENTE_MAX_RONDAS: '99', OPENROUTER_API_KEY: 'sk-or-secreta' });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain('sk-or-secreta');
    }
  });

  it('valida los límites del asistente', () => {
    expect(() => leerConfig({ ...base, AGENTE_MAX_RONDAS: '0' })).toThrow(/AGENTE_MAX_RONDAS/);
    expect(() => leerConfig({ ...base, AGENTE_MAX_RONDAS: '26' })).toThrow(/AGENTE_MAX_RONDAS/);
    expect(() => leerConfig({ ...base, AGENTE_RETENCION_DIAS: '0' })).toThrow(/AGENTE_RETENCION_DIAS/);
    expect(() => leerConfig({ ...base, AGENTE_TOPE_MENSUAL_USD: '-1' })).toThrow(/AGENTE_TOPE_MENSUAL_USD/);
    expect(() => leerConfig({ ...base, AGENTE_RAZONAMIENTO: 'mucho' })).toThrow(/AGENTE_RAZONAMIENTO/);
    expect(() => leerConfig({ ...base, AGENTE_MODELO: 'sin-barra' })).toThrow(/AGENTE_MODELO/);
    expect(leerConfig({ ...base, AGENTE_TOPE_MENSUAL_USD: '2.5' }).AGENTE_TOPE_MENSUAL_USD).toBe(2.5);
  });

  it('rechaza valores fuera de rango o de la lista', () => {
    expect(() => leerConfig({ ...base, PORT: '70000' })).toThrow(/PORT/);
    expect(() => leerConfig({ ...base, ALTA_DE_EMPRESAS: 'siempre' })).toThrow(/ALTA_DE_EMPRESAS/);
  });
});
