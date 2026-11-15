import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';

// Recorrido por HTTP real del servidor completo (identidad, empresas, guardia, lista blanca).

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
const correo = () => `u-${randomUUID().slice(0, 8)}@prueba.pe`;
const CLAVE = 'una-clave-larga-123';

async function registrar(cliente: ReturnType<AppDePruebas['cliente']>, nombre = 'Usuario de prueba') {
  const email = correo();
  const r = await cliente.post('/api/auth/sign-up/email', { email, password: CLAVE, name: nombre });
  expect(r.estado).toBe(200);
  return email;
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('acceso y sesión', () => {
  it('sin sesión, yo responde no_autenticado con el formato estándar', async () => {
    const r = await app.cliente().get('/api/v1/yo');
    expect(r.estado).toBe(401);
    expect(r.cuerpo).toMatchObject({ ok: false, error: { codigo: 'no_autenticado' } });
  });

  it('la salud es pública', async () => {
    const r = await app.cliente().get('/api/health');
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('registrarse, ver «yo» sin empresa y exigir empresa donde corresponde', async () => {
    const c = app.cliente();
    const email = await registrar(c);
    const yo = await c.get('/api/v1/yo');
    expect(yo.estado).toBe(200);
    expect(yo.cuerpo.datos).toMatchObject({ usuario: { correo: email }, empresa: null, empresas: [], puedeCrearEmpresas: true });
  });

  it('rechaza contraseñas cortas', async () => {
    const r = await app.cliente().post('/api/auth/sign-up/email', { email: correo(), password: 'corta', name: 'X' });
    expect(r.estado).toBeGreaterThanOrEqual(400);
  });

  it('cerrar sesión invalida el acceso', async () => {
    const c = app.cliente();
    await registrar(c);
    expect((await c.post('/api/auth/sign-out', {})).estado).toBe(200);
    expect((await c.get('/api/v1/yo')).estado).toBe(401);
  });
});

describe('empresas', () => {
  it('crea una empresa, queda activa, se aprovisiona y «yo» la muestra con rol owner', async () => {
    const c = app.cliente();
    await registrar(c);
    const creada = await c.post('/api/v1/empresas', { nombre: 'Imprenta de Prueba' });
    expect(creada.estado).toBe(201);
    const id = creada.cuerpo.datos.id as string;
    const yo = await c.get('/api/v1/yo');
    expect(yo.cuerpo.datos.empresa).toEqual({ id, nombre: 'Imprenta de Prueba', rol: 'owner' });
    // aprovisionada: su configuración existe y la ve la propia empresa
    const filas = await comoEmpresa(appPool, id, (cl) => cl.query('select zona_horaria from core.empresa_config'));
    expect(filas.rows).toEqual([{ zona_horaria: 'America/Lima' }]);
  });

  it('el gancho de sesión: al volver a entrar cae en su empresa más antigua', async () => {
    const c = app.cliente();
    const email = await registrar(c);
    const e1 = (await c.post('/api/v1/empresas', { nombre: 'Primera' })).cuerpo.datos.id;
    await c.post('/api/v1/empresas', { nombre: 'Segunda' });
    await c.post('/api/auth/sign-out', {});
    const otra = app.cliente();
    expect((await otra.post('/api/auth/sign-in/email', { email, password: CLAVE })).estado).toBe(200);
    expect((await otra.get('/api/v1/yo')).cuerpo.datos.empresa.id).toBe(e1);
  });

  it('dos usuarios de empresas distintas obtienen contextos distintos', async () => {
    const [a, b] = [app.cliente(), app.cliente()];
    await registrar(a, 'Ana');
    await registrar(b, 'Beto');
    const ea = (await a.post('/api/v1/empresas', { nombre: 'Empresa A' })).cuerpo.datos.id;
    const eb = (await b.post('/api/v1/empresas', { nombre: 'Empresa B' })).cuerpo.datos.id;
    expect((await a.get('/api/v1/yo')).cuerpo.datos.empresa.id).toBe(ea);
    expect((await b.get('/api/v1/yo')).cuerpo.datos.empresa.id).toBe(eb);
    expect(ea).not.toBe(eb);
  });

  it('desde la empresa A, la vista de miembros no muestra a los de la B', async () => {
    const [a, b] = [app.cliente(), app.cliente()];
    const ca = await registrar(a, 'Ana');
    await registrar(b, 'Beto');
    const ea = (await a.post('/api/v1/empresas', { nombre: 'Vista A' })).cuerpo.datos.id;
    await b.post('/api/v1/empresas', { nombre: 'Vista B' });
    const { rows } = await comoEmpresa(appPool, ea, (cl) => cl.query('select correo, rol from core.v_miembros'));
    expect(rows).toEqual([{ correo: ca, rol: 'owner' }]);
  });

  it('validar: un nombre vacío responde argumentos_invalidos', async () => {
    const c = app.cliente();
    await registrar(c);
    const r = await c.post('/api/v1/empresas', { nombre: ' ' });
    expect(r.estado).toBe(400);
    expect(r.cuerpo.error.codigo).toBe('argumentos_invalidos');
  });
});

describe('seguridad', () => {
  it('un miembro expulsado pierde el acceso en la siguiente petición aunque su sesión siga viva', async () => {
    const c = app.cliente();
    await registrar(c);
    const id = (await c.post('/api/v1/empresas', { nombre: 'Expulsión' })).cuerpo.datos.id;
    expect((await c.get('/api/v1/yo')).cuerpo.datos.empresa?.id).toBe(id);
    await auth.query('delete from auth.member where organization_id = $1', [id]);
    expect((await c.get('/api/v1/yo')).cuerpo.datos.empresa).toBeNull();
  });

  it.each([
    ['POST', '/api/auth/organization/create', { name: 'Colada', slug: 'colada' }],
    ['POST', '/api/auth/organization/delete', {}],
    ['POST', '/api/auth/organization/invite-member', {}],
    ['POST', '/api/auth/change-email', {}],
    ['POST', '/api/auth/delete-user', {}],
    ['POST', '/api/auth/request-password-reset', {}],
  ])('la ruta cerrada %s %s responde no_encontrado', async (_m, ruta, cuerpo) => {
    const c = app.cliente();
    await registrar(c);
    const r = await c.post(ruta, cuerpo);
    expect(r.estado).toBe(404);
    expect(r.cuerpo.error.codigo).toBe('no_encontrado');
  });

  it('capaz_app no puede leer contraseñas ni sesiones', async () => {
    await expect(appPool.query('select password from auth.account')).rejects.toThrow(/permission denied/);
    await expect(appPool.query('select token from auth.session')).rejects.toThrow(/permission denied/);
  });

  it('la contraseña se guarda con hash, nunca en claro', async () => {
    const c = app.cliente();
    const email = await registrar(c);
    const { rows } = await auth.query('select a.password from auth.account a join auth."user" u on u.id = a.user_id where u.email = $1', [email]);
    expect(rows[0].password).toBeTruthy();
    expect(rows[0].password).not.toContain(CLAVE);
  });
});

describe('alta de empresas cerrada', () => {
  it('con ALTA_DE_EMPRESAS=plataforma el usuario no puede crear su empresa', async () => {
    const cerrada = await levantarApp({ alta: 'plataforma' });
    try {
      const c = cerrada.cliente();
      const email = correo();
      await c.post('/api/auth/sign-up/email', { email, password: CLAVE, name: 'Sin empresa' });
      const r = await c.post('/api/v1/empresas', { nombre: 'No debería' });
      expect(r.estado).toBe(403);
      expect(r.cuerpo.error.codigo).toBe('sin_permiso');
      expect((await c.get('/api/v1/yo')).cuerpo.datos.puedeCrearEmpresas).toBe(false);
    } finally {
      await cerrada.cerrar();
    }
  });
});

describe('limitador de intentos', () => {
  it('tras varios intentos fallidos de inicio de sesión responde demasiados intentos', async () => {
    const limitada = await levantarApp({ intentos: 3 });
    try {
      const c = limitada.cliente();
      const estados: number[] = [];
      for (let i = 0; i < 6; i++) estados.push((await c.post('/api/auth/sign-in/email', { email: correo(), password: 'incorrecta-123' })).estado);
      expect(estados).toContain(429);
    } finally {
      await limitada.cerrar();
    }
  });
});
