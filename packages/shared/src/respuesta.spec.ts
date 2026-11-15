import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CODIGOS, codigoDeEstado, esCodigo, estadoHttp } from './codigos.js';
import { exito, rechazo, respuestaSchema } from './respuesta.js';

const esquema = respuestaSchema(z.strictObject({ n: z.number() }));

describe('contrato de respuesta', () => {
  it('acepta un éxito con avisos', () => {
    expect(esquema.safeParse(exito({ n: 1 })).success).toBe(true);
  });

  it('acepta un rechazo con candidatas', () => {
    const r = rechazo('conflicto', 'Hay dos Juan.', [{ id: 'a', nombre: 'Juan Pérez' }]);
    expect(esquema.safeParse(r).success).toBe(true);
  });

  it('acepta una petición de confirmación', () => {
    const r = {
      ok: false,
      requiereConfirmacion: { resumen: '¿Emito?', token: 't.f', venceEn: new Date().toISOString() },
    };
    expect(esquema.safeParse(r).success).toBe(true);
  });

  it('rechaza un código fuera del catálogo y campos de más', () => {
    expect(esquema.safeParse({ ok: false, error: { codigo: 'inventado', mensaje: 'x' } }).success).toBe(false);
    expect(esquema.safeParse({ ...exito({ n: 1 }), extra: 1 }).success).toBe(false);
  });

  it('rechaza datos que no cumplen el esquema de la herramienta', () => {
    expect(esquema.safeParse(exito({ n: 'uno' })).success).toBe(false);
  });
});

describe('catálogo de códigos', () => {
  it('todo código tiene un estado HTTP de error', () => {
    for (const estado of Object.values(CODIGOS)) expect(estado).toBeGreaterThanOrEqual(400);
  });

  it('reconoce códigos y rechaza el resto', () => {
    expect(esCodigo('sin_permiso')).toBe(true);
    expect(esCodigo('toString')).toBe(false);
    expect(esCodigo(5)).toBe(false);
  });

  it('traduce estados HTTP a códigos y viceversa', () => {
    expect(codigoDeEstado(404)).toBe('no_encontrado');
    expect(codigoDeEstado(502)).toBe('error_interno');
    expect(estadoHttp('demasiados_intentos')).toBe(429);
  });
});
