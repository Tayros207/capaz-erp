import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from './http-de-pruebas.js';

// Herramientas por HTTP real: la puerta `POST /api/v1/herramientas/:nombre` con las herramientas
// del núcleo (empresa, módulos y auditoría) sobre el servidor completo y la base de pruebas.

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
let dueno: Sesion; // owner de la empresa A
let admin: Sesion; // admin de la empresa A
let miembro: Sesion; // member de la empresa A
let ajeno: Sesion; // owner de la empresa B
let empresaA: string;
let empresaB: string;

async function unirse(sesion: Sesion, empresaId: string, rol: 'admin' | 'member') {
  await auth.query('insert into auth.member (id, organization_id, user_id, role, created_at) values ($1, $2, $3, $4, now())', [
    randomUUID(),
    empresaId,
    sesion.usuarioId,
    rol,
  ]);
  const r = await sesion.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaId });
  expect(r.estado).toBe(200);
}

const auditoriaDe = (empresaId: string) =>
  comoEmpresa(appPool, empresaId, async (c) => (await c.query('select * from core.auditoria order by creado_en, id')).rows as Record<string, any>[]);
const configuracion = async (s: Sesion) => (await s.herramienta('empresa_ver_configuracion', {})).cuerpo.datos;
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;

async function pedirToken(s: Sesion, args: Record<string, unknown>) {
  const r = await s.herramienta('empresa_actualizar_configuracion', args);
  expect(r.estado).toBe(200);
  expect(r.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
  return r.cuerpo.requiereConfirmacion.token as string;
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
  [dueno, admin, miembro, ajeno] = await Promise.all([
    abrirSesion(app, 'Dueña'),
    abrirSesion(app, 'Admin'),
    abrirSesion(app, 'Miembro'),
    abrirSesion(app, 'Ajena'),
  ]);
  empresaA = await crearEmpresa(dueno, 'Empresa A de herramientas');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de herramientas');
  await unirse(admin, empresaA, 'admin');
  await unirse(miembro, empresaA, 'member');
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('la puerta HTTP', () => {
  it('sin sesión responde no_autenticado', async () => {
    const anonimo = await abrirSesion(app);
    const sinSesion = await anonimo.pedir('POST', '/api/auth/sign-out', {});
    expect(sinSesion.estado).toBe(200);
    const r = await anonimo.herramienta('empresa_ver_configuracion', {});
    expect(r.estado).toBe(401);
    expect(codigo(r)).toBe('no_autenticado');
  });

  it('sin empresa activa responde sin_empresa', async () => {
    const sola = await abrirSesion(app);
    const r = await sola.herramienta('empresa_ver_configuracion', {});
    expect(r.estado).toBe(403);
    expect(codigo(r)).toBe('sin_empresa');
  });

  it('un origen que no está permitido (o ausente) se rechaza antes de ejecutar nada', async () => {
    const antes = (await auditoriaDe(empresaA)).length;
    for (const cabeceras of [{ origin: 'https://otro-sitio.example' }, { origin: '' }]) {
      const r = await dueno.herramienta('empresa_ver_configuracion', {}, { cabeceras });
      expect(r.estado).toBe(403);
      expect(codigo(r)).toBe('origen_invalido');
    }
    expect((await auditoriaDe(empresaA)).length).toBe(antes);
  });

  it('responde con Cache-Control: no-store, también en los rechazos', async () => {
    expect((await dueno.herramienta('empresa_ver_configuracion', {})).cabeceras.get('cache-control')).toBe('no-store');
    expect((await dueno.herramienta('no_existe', {})).cabeceras.get('cache-control')).toBe('no-store');
  });

  it('un cuerpo con llaves de más (canal, empresa) es una solicitud inválida; uno enorme, demasiado grande', async () => {
    const r = await dueno.herramienta('empresa_ver_configuracion', undefined, { cuerpo: { args: {}, canal: 'agente', empresaId: empresaB } });
    expect(r.estado).toBe(400);
    expect(codigo(r)).toBe('solicitud_invalida');
    const grande = await dueno.herramienta('empresa_ver_configuracion', { relleno: 'x'.repeat(300_000) });
    expect(grande.estado).toBe(413);
    expect(codigo(grande)).toBe('solicitud_muy_grande');
  });

  it('una clave de idempotencia con caracteres raros es una solicitud inválida', async () => {
    const r = await dueno.herramienta('empresa_ver_configuracion', {}, { clave: 'tiene espacios' });
    expect(codigo(r)).toBe('solicitud_invalida');
  });

  it('una herramienta desconocida responde herramienta_desconocida y queda auditada', async () => {
    const r = await dueno.herramienta('no_existe', {});
    expect(r.estado).toBe(404);
    expect(codigo(r)).toBe('herramienta_desconocida');
    expect((await auditoriaDe(empresaA)).some((f) => f.herramienta === 'no_existe' && f.resultado === 'rechazada')).toBe(true);
  });

  it('un argumento reservado (empresaId) se rechaza y queda auditado en la empresa de la sesión', async () => {
    const antes = (await auditoriaDe(empresaB)).length;
    const r = await dueno.herramienta('empresa_ver_configuracion', { empresaId: empresaB });
    expect(r.estado).toBe(400);
    expect(codigo(r)).toBe('argumento_prohibido');
    expect((await auditoriaDe(empresaB)).length).toBe(antes);
    expect((await auditoriaDe(empresaA)).some((f) => f.codigo === 'argumento_prohibido')).toBe(true);
  });
});

describe('empresa_ver_configuracion y permisos', () => {
  it('la ve el dueño, el admin y un member (lectura); cada empresa ve la suya', async () => {
    for (const s of [dueno, admin, miembro, ajeno]) {
      const r = await s.herramienta('empresa_ver_configuracion', {});
      expect(r.estado).toBe(200);
      expect(r.cuerpo).toMatchObject({ ok: true, datos: { zonaHoraria: 'America/Lima', moneda: 'PEN', locale: 'es-PE' } });
    }
  });

  it('un member no puede cambiarla: sin_permiso, y nada cambia', async () => {
    const r = await miembro.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' });
    expect(r.estado).toBe(403);
    expect(codigo(r)).toBe('sin_permiso');
    expect((await configuracion(dueno)).moneda).toBe('PEN');
  });
});

describe('empresa_actualizar_configuracion: crítica, con confirmación', () => {
  it('sin confirmación pide confirmar y no cambia nada; con el token cambia solo lo pedido', async () => {
    const token = await pedirToken(dueno, { zonaHoraria: 'America/Bogota' });
    expect((await configuracion(dueno)).zonaHoraria).toBe('America/Lima');
    const r = await dueno.herramienta('empresa_actualizar_configuracion', { zonaHoraria: 'America/Bogota' }, { confirmacion: token });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { zonaHoraria: 'America/Bogota', moneda: 'PEN', locale: 'es-PE' } });
    expect((await configuracion(dueno)).zonaHoraria).toBe('America/Bogota');
    // las dos llamadas quedaron auditadas, sin argumentos en claro
    const filas = (await auditoriaDe(empresaA)).filter((f) => f.herramienta === 'empresa_actualizar_configuracion');
    expect(filas.slice(-2).map((f) => f.resultado)).toEqual(['pendiente_confirmacion', 'ok']);
    expect(JSON.stringify(filas)).not.toContain('Bogota');
    expect(filas.at(-1)!.resumen).toEqual({ campos: 'zonaHoraria' });
    expect(filas.at(-1)!.hash_args).toMatch(/^[0-9a-f]{64}$/);
  });

  it('el token no se reutiliza', async () => {
    const token = await pedirToken(dueno, { moneda: 'USD' });
    expect((await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: token })).cuerpo.ok).toBe(true);
    const otra = await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: token });
    expect(otra.estado).toBe(409);
    expect(codigo(otra)).toBe('confirmacion_ya_usada');
    // restaura para las demás pruebas
    const t2 = await pedirToken(dueno, { moneda: 'PEN' });
    await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'PEN' }, { confirmacion: t2 });
  });

  it('el mismo token usado dos veces a la vez solo vale una', async () => {
    const token = await pedirToken(dueno, { locale: 'es-CO' });
    const rs = await Promise.all([1, 2].map(() => dueno.herramienta('empresa_actualizar_configuracion', { locale: 'es-CO' }, { confirmacion: token })));
    expect(rs.filter((r) => r.cuerpo.ok)).toHaveLength(1);
    expect(rs.map(codigo).filter(Boolean)).toEqual(['confirmacion_ya_usada']);
    const t2 = await pedirToken(dueno, { locale: 'es-PE' });
    await dueno.herramienta('empresa_actualizar_configuracion', { locale: 'es-PE' }, { confirmacion: t2 });
  });

  it('un token pedido con otros argumentos no vale', async () => {
    const token = await pedirToken(dueno, { moneda: 'USD' });
    const r = await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'EUR' }, { confirmacion: token });
    expect(codigo(r)).toBe('confirmacion_no_coincide');
    expect((await configuracion(dueno)).moneda).toBe('PEN');
  });

  it('el token de otra persona (otro usuario de la misma empresa) no vale, y el dueño aún puede usarlo', async () => {
    const token = await pedirToken(dueno, { moneda: 'USD' });
    const r = await admin.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: token });
    expect(codigo(r)).toBe('confirmacion_no_coincide');
    expect((await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: token })).cuerpo.ok).toBe(true);
    const t2 = await pedirToken(dueno, { moneda: 'PEN' });
    await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'PEN' }, { confirmacion: t2 });
  });

  it('el token de otra empresa no vale', async () => {
    const token = await pedirToken(dueno, { moneda: 'USD' });
    const r = await ajeno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: token });
    expect(codigo(r)).toBe('confirmacion_no_coincide');
    expect((await configuracion(ajeno)).moneda).toBe('PEN');
  });

  it('si la configuración cambió después de pedir la confirmación, el token ya no vale', async () => {
    const lento = await pedirToken(dueno, { moneda: 'USD' });
    const rapido = await pedirToken(admin, { locale: 'es-EC' });
    expect((await admin.herramienta('empresa_actualizar_configuracion', { locale: 'es-EC' }, { confirmacion: rapido })).cuerpo.ok).toBe(true);
    const r = await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: lento });
    expect(codigo(r)).toBe('confirmacion_desactualizada');
    const t2 = await pedirToken(dueno, { locale: 'es-PE' });
    await dueno.herramienta('empresa_actualizar_configuracion', { locale: 'es-PE' }, { confirmacion: t2 });
  });

  it('un token inventado o de otro secreto es inválido', async () => {
    const r = await dueno.herramienta('empresa_actualizar_configuracion', { moneda: 'USD' }, { confirmacion: 'inventado.xxx' });
    expect(codigo(r)).toBe('confirmacion_invalida');
  });

  it('datos inválidos: sin cambios, zona inexistente o moneda mal escrita', async () => {
    for (const args of [{}, { zonaHoraria: 'Marte/Olympus' }, { moneda: 'usd' }, { locale: '!!' }, { otra: 1 }]) {
      const r = await dueno.herramienta('empresa_actualizar_configuracion', args);
      expect(r.estado, JSON.stringify(args)).toBe(400);
      expect(codigo(r)).toBe('argumentos_invalidos');
    }
  });
});

describe('modulo_solicitar: normal e idempotente', () => {
  it('registra la solicitud; la repetición con la misma clave devuelve la misma respuesta sin duplicar', async () => {
    const clave = randomUUID();
    const a = await admin.herramienta('modulo_solicitar', { modulo: 'crm', nota: 'Lo necesitamos' }, { clave });
    expect(a.cuerpo).toMatchObject({ ok: true, datos: { modulo: 'crm', estado: 'pendiente', yaSolicitado: false } });
    const b = await admin.herramienta('modulo_solicitar', { modulo: 'crm', nota: 'Lo necesitamos' }, { clave });
    expect(b.cuerpo).toEqual(a.cuerpo);
    const filas = await comoEmpresa(appPool, empresaA, async (c) => (await c.query(`select usuario_id, nota from core.solicitudes_modulo where modulo = 'crm'`)).rows);
    expect(filas).toEqual([{ usuario_id: admin.usuarioId, nota: 'Lo necesitamos' }]);
  });

  it('la misma clave con otros argumentos es un conflicto', async () => {
    const clave = randomUUID();
    await dueno.herramienta('modulo_solicitar', { modulo: 'ordenes' }, { clave });
    const r = await dueno.herramienta('modulo_solicitar', { modulo: 'compras' }, { clave });
    expect(r.estado).toBe(409);
    expect(codigo(r)).toBe('conflicto');
  });

  it('dos peticiones simultáneas con la misma clave dan una sola solicitud y la misma respuesta', async () => {
    const clave = randomUUID();
    const [a, b] = await Promise.all([1, 2].map(() => miembro.herramienta('modulo_solicitar', { modulo: 'insumos' }, { clave })));
    expect(a!.cuerpo).toEqual(b!.cuerpo);
    expect(a!.cuerpo.ok).toBe(true);
    const n = await comoEmpresa(appPool, empresaA, async (c) => (await c.query(`select 1 from core.solicitudes_modulo where modulo = 'insumos'`)).rowCount);
    expect(n).toBe(1);
  });

  it('sin clave, pedir lo mismo otra vez avisa que ya estaba solicitado en vez de duplicar', async () => {
    const r = await miembro.herramienta('modulo_solicitar', { modulo: 'insumos' });
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { modulo: 'insumos', yaSolicitado: true } });
  });

  it('un módulo que no existe, o que la empresa ya tiene activo, se rechaza', async () => {
    expect(codigo(await dueno.herramienta('modulo_solicitar', { modulo: 'no_existe' }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('modulo_solicitar', { modulo: 'core' }))).toBe('no_encontrado');
    expect(codigo(await dueno.herramienta('modulo_solicitar', { modulo: 'registro' }))).toBe('conflicto');
  });

  it('la solicitud de una empresa no la ve la otra', async () => {
    const n = await comoEmpresa(appPool, empresaB, async (c) => (await c.query('select 1 from core.solicitudes_modulo')).rowCount);
    expect(n).toBe(0);
  });
});

describe('auditoria_listar', () => {
  it('lista lo de la empresa, lo más nuevo primero, con cursor, y sin argumentos en claro', async () => {
    const previas = (await auditoriaDe(empresaA)).length;
    const todas: any[] = [];
    let cursor: string | undefined;
    let paginas = 0;
    do {
      const r = await dueno.herramienta('auditoria_listar', { limite: 4, ...(cursor && { cursor }) });
      expect(r.estado).toBe(200);
      todas.push(...r.cuerpo.datos.items);
      cursor = r.cuerpo.datos.siguiente ?? undefined;
      paginas++;
    } while (cursor && paginas < 50);
    expect(paginas).toBeGreaterThan(1);
    const ids = todas.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    // todo lo anterior a la propia consulta de lectura está, y en orden descendente
    const fechas = todas.map((f) => Date.parse(f.creadoEn));
    expect([...fechas].sort((x, y) => y - x)).toEqual(fechas);
    // nada se pierde entre páginas: están todas las anteriores a la consulta (más las de la propia consulta)
    expect(todas.length).toBeGreaterThanOrEqual(previas);
    expect(JSON.stringify(todas)).not.toMatch(/Bogota|"USD"|hashArgs|hash_args/);
    expect(todas.every((f) => f.usuarioId && f.requestId && f.canal === 'ui')).toBe(true);
  });

  it('filtra por herramienta y por resultado', async () => {
    const r = await dueno.herramienta('auditoria_listar', { herramienta: 'empresa_actualizar_configuracion', resultado: 'pendiente_confirmacion', limite: 100 });
    expect(r.cuerpo.datos.items.length).toBeGreaterThan(0);
    expect(r.cuerpo.datos.items.every((f: any) => f.herramienta === 'empresa_actualizar_configuracion' && f.resultado === 'pendiente_confirmacion')).toBe(true);
  });

  it('un member (lectura) la ve; cada empresa ve solo lo suyo', async () => {
    const mia = await miembro.herramienta('auditoria_listar', { limite: 100 });
    expect(mia.estado).toBe(200);
    const deB = await ajeno.herramienta('auditoria_listar', { limite: 100 });
    const usuariosDeB = new Set(deB.cuerpo.datos.items.map((f: any) => f.usuarioId));
    expect([...usuariosDeB]).toEqual([ajeno.usuarioId]);
  });

  it('un cursor inventado se rechaza', async () => {
    const r = await dueno.herramienta('auditoria_listar', { cursor: 'basura' });
    expect(codigo(r)).toBe('argumentos_invalidos');
  });

  it('la auditoría no admite update ni delete, ni siquiera por la propia empresa', async () => {
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query(`update core.auditoria set codigo = 'x'`))).rejects.toThrow();
    await expect(comoEmpresa(appPool, empresaA, (c) => c.query('delete from core.auditoria'))).rejects.toThrow();
  });
});
