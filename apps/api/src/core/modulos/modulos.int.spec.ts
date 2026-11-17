import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Controller, Get } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { RequiereModulo, RequierePermiso } from '../../infra/http/decoradores.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas, type ClienteHttp } from '../../pruebas/app-de-pruebas.js';

// Módulos, contratación y permisos por HTTP real (fase 4, servidor).

@Controller('v1/prueba')
class RutasDePrueba {
  @Get('registro') @RequiereModulo('registro') registro() { return { ok: true }; }
  @Get('cotizador') @RequiereModulo('cotizador') cotizador() { return { ok: true }; }
  @Get('editar-registro') @RequierePermiso('registro:editar') editar() { return { ok: true }; }
}

let app: AppDePruebas;
let auth: pg.Pool;
let sistema: pg.Pool;
let appPool: pg.Pool;
const CLAVE = 'una-clave-larga-123';
const correo = () => `m-${randomUUID().slice(0, 8)}@prueba.pe`;

async function dueno(nombreEmpresa: string) {
  const c = app.cliente();
  const email = correo();
  await c.post('/api/auth/sign-up/email', { email, password: CLAVE, name: 'Dueña' });
  const empresaId = (await c.post('/api/v1/empresas', { nombre: nombreEmpresa })).cuerpo.datos.id as string;
  return { c, email, empresaId };
}

/** Agrega a una persona nueva como `member` de la empresa (directo en la base de autenticación). */
async function miembro(empresaId: string): Promise<{ c: ClienteHttp; usuarioId: string }> {
  const c = app.cliente();
  const email = correo();
  const reg = await c.post('/api/auth/sign-up/email', { email, password: CLAVE, name: 'Miembro' });
  const usuarioId = reg.cuerpo.user.id as string;
  await auth.query(`insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, 'member', now())`, [randomUUID(), empresaId, usuarioId]);
  await auth.query(`update auth.session set active_organization_id = $1 where user_id = $2`, [empresaId, usuarioId]);
  // la caché de cookie de la sesión guarda la empresa activa: se vuelve a entrar
  const c2 = app.cliente();
  await c2.post('/api/auth/sign-in/email', { email, password: CLAVE });
  return { c: c2, usuarioId };
}

const modulo = (yo: any, codigo: string) => yo.cuerpo.datos.modulos.find((m: any) => m.codigo === codigo)?.acceso;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta', controladores: [RutasDePrueba] });
  auth = abrirPool('auth');
  sistema = abrirPool('sistema');
  appPool = abrirPool('app');
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([auth.end(), sistema.end(), appPool.end()]);
});

describe('empresa nueva', () => {
  it('recibe el Registro en prueba de 30 días y el Cotizador sin contratar', async () => {
    const { c } = await dueno('Taller Nuevo');
    const yo = await c.get('/api/v1/yo');
    expect(modulo(yo, 'registro')).toMatchObject({ motivo: 'prueba', puedeEntrar: true, puedeEscribir: true, diasDePrueba: 30 });
    expect(modulo(yo, 'cotizador')).toMatchObject({ motivo: 'no_contratado', puedeEntrar: false, visible: true });
    expect(yo.cuerpo.datos.modulos.map((m: any) => m.codigo)).toEqual(['registro', 'cotizador', 'crm', 'ordenes', 'compras', 'insumos', 'personal', 'reportes', 'webhooks', 'produccion']);
    expect(yo.cuerpo.datos.modulos.map((m: any) => `${m.codigo}:${m.familia}:${m.orden}`)).toEqual([
      'registro:finanzas:1',
      'cotizador:ventas:3',
      'crm:ventas:1',
      'ordenes:ventas:2',
      'compras:compras:1',
      'insumos:inventario:1',
      'personal:personal:1',
      'reportes:analisis:1',
      'webhooks:conexiones:1',
      'produccion:produccion:1',
    ]);
  });

  it('el aprovisionamiento es idempotente: repetirlo no reinicia ni duplica la contratación', async () => {
    const { c, empresaId } = await dueno('Idempotente');
    await c.get('/api/v1/yo');
    await sistema.query(`select core.dar_baja_modulo($1, 'registro', 'prueba', 'test')`, [empresaId]);
    await c.get('/api/v1/yo');
    const { rows } = await sistema.query('select estado from core.empresa_modulos where tenant_id = $1', [empresaId]);
    expect(rows).toEqual([{ estado: 'baja' }]);
  });

  it('el historial deja la activación con actor «sistema:alta-de-empresa»', async () => {
    const { empresaId } = await dueno('Historial');
    const { rows } = await sistema.query('select evento, actor from core.empresa_modulos_eventos where tenant_id = $1', [empresaId]);
    expect(rows).toEqual([{ evento: 'prueba', actor: 'sistema:alta-de-empresa' }]);
  });
});

describe('guardas por módulo y permiso', () => {
  it('el dueño entra a lo contratado; a lo no contratado, modulo_no_disponible', async () => {
    const { c } = await dueno('Guardas');
    expect((await c.get('/api/v1/prueba/registro')).estado).toBe(200);
    const r = await c.get('/api/v1/prueba/cotizador');
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('modulo_no_disponible');
  });

  it('sin sesión, no_autenticado; con sesión pero sin empresa, sin_empresa', async () => {
    expect((await app.cliente().get('/api/v1/prueba/registro')).cuerpo.error.codigo).toBe('no_autenticado');
    const c = app.cliente();
    await c.post('/api/auth/sign-up/email', { email: correo(), password: CLAVE, name: 'Sin empresa' });
    expect((await c.get('/api/v1/prueba/registro')).cuerpo.error.codigo).toBe('sin_empresa');
  });

  it('un member sin asignación no entra; con asignación completa entra; con lectura entra sin permiso de editar', async () => {
    const { empresaId } = await dueno('Asignaciones');
    const { c, usuarioId } = await miembro(empresaId);
    expect((await c.get('/api/v1/prueba/registro')).cuerpo.error.codigo).toBe('modulo_no_disponible');
    expect(modulo(await c.get('/api/v1/yo'), 'registro')).toMatchObject({ motivo: 'sin_asignar', puedeEntrar: false, visible: true });

    const asignar = (nivel: string) => comoEmpresa(appPool, empresaId, (cl) => cl.query(
      `insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel) values ($1, $2, 'registro', $3)
       on conflict (tenant_id, usuario_id, modulo) do update set nivel = excluded.nivel`, [empresaId, usuarioId, nivel]), { confirmar: true });

    await asignar('lectura');
    expect((await c.get('/api/v1/prueba/registro')).estado).toBe(200);
    const sinEditar = await c.get('/api/v1/prueba/editar-registro');
    expect(sinEditar.estado).toBe(403);
    expect(sinEditar.cuerpo.error.codigo).toBe('sin_permiso');

    await asignar('completo');
    expect((await c.get('/api/v1/prueba/editar-registro')).estado).toBe(200);
    expect((await c.get('/api/v1/yo')).cuerpo.datos.permisos).toContain('registro:editar');
  });
});

describe('cambios desde la plataforma se notan en la siguiente petición', () => {
  it('suspender deja el módulo en solo lectura; reactivar lo devuelve; dar de baja también', async () => {
    const { c, empresaId } = await dueno('Plataforma');
    const estado = async () => modulo(await c.get('/api/v1/yo'), 'registro');
    expect(await estado()).toMatchObject({ puedeEscribir: true });

    await sistema.query(`select core.suspender_modulo($1, 'registro', 'mora', 'op')`, [empresaId]);
    expect(await estado()).toMatchObject({ motivo: 'suspendido', puedeEntrar: true, puedeEscribir: false });
    expect((await c.get('/api/v1/prueba/editar-registro')).cuerpo.error.codigo).toBe('sin_permiso');
    expect((await c.get('/api/v1/prueba/registro')).estado).toBe(200); // lectura sí

    await sistema.query(`select core.reactivar_modulo($1, 'registro', 'op')`, [empresaId]);
    expect(await estado()).toMatchObject({ motivo: 'activo', puedeEscribir: true });

    await sistema.query(`select core.dar_baja_modulo($1, 'registro', 'cancelación', 'op')`, [empresaId]);
    expect(await estado()).toMatchObject({ motivo: 'baja_solo_lectura', puedeEscribir: false });
  });

  it('una prueba vencida equivale a baja', async () => {
    const { c, empresaId } = await dueno('Vencida');
    await sistema.query(`update core.empresa_modulos set prueba_hasta = now() - interval '1 day' where tenant_id = $1`, [empresaId]);
    expect(modulo(await c.get('/api/v1/yo'), 'registro')).toMatchObject({ motivo: 'baja_solo_lectura', puedeEscribir: false });
  });

  it('una empresa no ve ni modifica la contratación de otra', async () => {
    const a = await dueno('Empresa A');
    const b = await dueno('Empresa B');
    await sistema.query(`select core.dar_baja_modulo($1, 'registro', 'x', 'op')`, [a.empresaId]);
    expect(modulo(await b.c.get('/api/v1/yo'), 'registro')).toMatchObject({ motivo: 'prueba', puedeEscribir: true });
    expect(modulo(await a.c.get('/api/v1/yo'), 'registro')).toMatchObject({ motivo: 'baja_solo_lectura' });
  });
});
