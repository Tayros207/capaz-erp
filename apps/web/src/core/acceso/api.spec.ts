import { afterEach, describe, expect, it, vi } from 'vitest';
import { cerrarSesion, crearEmpresa, interpretarAuth, iniciarSesion, registrarse } from './api.ts';
import { mensajeDeError, type Situacion } from './mensajes.ts';
import { CODIGOS, type Codigo } from '@capaz/shared';

afterEach(() => vi.unstubAllGlobals());

function simular(estado: number, cuerpo: string) {
  const f = vi.fn(async () => new Response(cuerpo, { status: estado }));
  vi.stubGlobal('fetch', f);
  return f;
}

describe('interpretarAuth', () => {
  it('un 200 con el JSON propio de Better Auth es éxito', () => {
    expect(interpretarAuth(200, JSON.stringify({ token: 't', user: {} })).ok).toBe(true);
  });
  it('traduce el estado al código del catálogo', () => {
    const r = interpretarAuth(401, JSON.stringify({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'x' }));
    expect(r).toMatchObject({ ok: false, error: { codigo: 'no_autenticado' } });
    expect(interpretarAuth(422, '{}')).toMatchObject({ error: { codigo: 'solicitud_invalida' } });
    expect(interpretarAuth(429, '')).toMatchObject({ error: { codigo: 'demasiados_intentos' } });
    expect(interpretarAuth(502, '<html>')).toMatchObject({ error: { codigo: 'error_interno' } });
  });
});

describe('llamadas', () => {
  it('iniciar sesión envía correo recortado y la cookie viaja (same-origin)', async () => {
    const f = simular(200, '{"token":"t"}');
    expect((await iniciarSesion({ correo: ' a@b.pe ', clave: 'abc' })).ok).toBe(true);
    const [ruta, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(ruta).toBe('/api/auth/sign-in/email');
    expect(init.credentials).toBe('same-origin');
    expect(JSON.parse(init.body as string)).toEqual({ email: 'a@b.pe', password: 'abc' });
  });
  it('registrarse usa name/email/password', async () => {
    const f = simular(200, '{}');
    await registrarse({ nombre: ' Ana ', correo: 'a@b.pe', clave: '1234567890' });
    const [ruta, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(ruta).toBe('/api/auth/sign-up/email');
    expect(JSON.parse(init.body as string)).toEqual({ name: 'Ana', email: 'a@b.pe', password: '1234567890' });
  });
  it('cerrar sesión llama a sign-out', async () => {
    const f = simular(200, '{"success":true}');
    expect((await cerrarSesion()).ok).toBe(true);
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe('/api/auth/sign-out');
  });
  it('una caída de red es sin_conexion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('red'); }));
    expect(await iniciarSesion({ correo: 'a@b.pe', clave: 'x' })).toMatchObject({ error: { codigo: 'sin_conexion' } });
  });
  it('crear empresa usa el contrato Respuesta', async () => {
    simular(201, JSON.stringify({ ok: true, datos: { id: 'e1', nombre: 'Sol' }, avisos: [] }));
    const r = await crearEmpresa(' Sol ');
    expect(r.ok && r.datos).toEqual({ id: 'e1', nombre: 'Sol' });
  });
});

describe('mensajes por código', () => {
  it('textos propios por pantalla', () => {
    expect(mensajeDeError('no_autenticado', 'iniciar')).toBe('El correo o la contraseña no son correctos.');
    expect(mensajeDeError('conflicto', 'registro')).toMatch(/Ya existe una cuenta/);
    expect(mensajeDeError('sin_permiso', 'empresa')).toMatch(/aún no tiene empresa/);
  });
  it('todo código del catálogo tiene un mensaje en español no vacío en cada pantalla', () => {
    for (const s of ['iniciar', 'registro', 'empresa', 'salir'] as Situacion[]) {
      for (const c of Object.keys(CODIGOS) as Codigo[]) expect(mensajeDeError(c, s).length).toBeGreaterThan(10);
    }
  });
});
