import { afterEach, describe, expect, it, vi } from 'vitest';
import { yoSchema } from '@capaz/shared';
import { interpretarRespuesta, pedir } from './cliente.ts';

const yo = {
  usuario: { id: 'u1', nombre: 'Ana', correo: 'ana@ejemplo.pe' },
  empresa: null,
  empresas: [],
  puedeCrearEmpresas: true,
  modulos: [],
  permisos: [],
  operador: false,
};

function simular(estado: number, cuerpo: string) {
  const fetchSimulado = vi.fn(async () => new Response(cuerpo, { status: estado }));
  vi.stubGlobal('fetch', fetchSimulado);
  return fetchSimulado;
}

afterEach(() => vi.unstubAllGlobals());

describe('interpretarRespuesta', () => {
  it('acepta un éxito con la forma del contrato', () => {
    const r = interpretarRespuesta(200, JSON.stringify({ ok: true, datos: yo, avisos: [] }), yoSchema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.datos.usuario.nombre).toBe('Ana');
  });

  it('acepta un rechazo del contrato tal cual', () => {
    const cuerpo = { ok: false, error: { codigo: 'no_autenticado', mensaje: 'Inicia sesión.' } };
    const r = interpretarRespuesta(401, JSON.stringify(cuerpo), yoSchema);
    expect(r).toEqual(cuerpo);
  });

  it('un éxito con datos que no cumplen el esquema es error_interno', () => {
    const r = interpretarRespuesta(200, JSON.stringify({ ok: true, datos: { x: 1 }, avisos: [] }), yoSchema);
    expect(r.ok === false && 'error' in r && r.error.codigo).toBe('error_interno');
  });

  it('un cuerpo que no es JSON se traduce por el estado HTTP', () => {
    const r = interpretarRespuesta(502, '<html>Bad gateway</html>', yoSchema);
    expect(r.ok === false && 'error' in r && r.error.codigo).toBe('error_interno');
    const r401 = interpretarRespuesta(401, '', yoSchema);
    expect(r401.ok === false && 'error' in r401 && r401.error.codigo).toBe('no_autenticado');
  });
});

describe('pedir', () => {
  it('GET sin cuerpo ni content-type', async () => {
    const f = simular(200, JSON.stringify({ ok: true, datos: yo, avisos: [] }));
    const r = await pedir('GET', '/api/v1/yo', yoSchema);
    expect(r.ok).toBe(true);
    const [ruta, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(ruta).toBe('/api/v1/yo');
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('content-type');
  });

  it('POST envía el cuerpo como JSON', async () => {
    const f = simular(200, JSON.stringify({ ok: true, datos: yo, avisos: [] }));
    await pedir('POST', '/api/v1/empresas', yoSchema, { nombre: 'Mi empresa' });
    const [, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.body).toBe('{"nombre":"Mi empresa"}');
    expect(init.headers).toHaveProperty('content-type', 'application/json');
  });

  it('una caída de red no lanza: es sin_conexion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const r = await pedir('GET', '/api/v1/yo', yoSchema);
    expect(r.ok === false && 'error' in r && r.error.codigo).toBe('sin_conexion');
  });
});
