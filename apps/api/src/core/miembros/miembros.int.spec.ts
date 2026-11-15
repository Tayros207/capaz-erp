import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';

// Fase 6b por HTTP real: invitar, aceptar, cambiar rol, quitar y asignar módulos, con el servidor completo.

let app: AppDePruebas;
let auth: pg.Pool;
let appPool: pg.Pool;
let owner: Sesion;
let ajeno: Sesion; // owner de la empresa B
let empresaA: string;
let empresaB: string;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;

/** Llama a una herramienta crítica: pide el token y la confirma. */
async function confirmada(s: Sesion, nombre: string, args: Record<string, unknown>) {
  const primera = await s.herramienta(nombre, args);
  if (primera.cuerpo?.requiereConfirmacion) return s.herramienta(nombre, args, { confirmacion: primera.cuerpo.requiereConfirmacion.token });
  return primera;
}

/** Invita a `s` (ya registrada) a la empresa de `quien`, acepta y deja la empresa activa. */
async function incorporar(quien: Sesion, s: Sesion, rol: 'admin' | 'member'): Promise<string> {
  const inv = await confirmada(quien, 'invitacion_crear', { correo: s.correo, rol });
  expect(inv.cuerpo.ok, JSON.stringify(inv.cuerpo)).toBe(true);
  const id = inv.cuerpo.datos.id as string;
  const acepta = await s.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: id });
  expect(acepta.estado).toBe(200);
  expect((await s.pedir('POST', '/api/auth/organization/set-active', { organizationId: empresaA })).estado).toBe(200);
  return id;
}

const rolEn = async (empresaId: string, s: Sesion) =>
  (await auth.query('select role from auth.member where organization_id = $1 and user_id = $2', [empresaId, s.usuarioId])).rows[0]?.role as string | undefined;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  auth = abrirPool('auth');
  appPool = abrirPool('app');
  owner = await abrirSesion(app, 'Dueña A');
  empresaA = await crearEmpresa(owner, 'Empresa A');
  ajeno = await abrirSesion(app, 'Dueño B');
  empresaB = await crearEmpresa(ajeno, 'Empresa B');
});
afterAll(async () => {
  await app.cerrar();
  await auth.end();
  await appPool.end();
});

describe('invitar y aceptar', () => {
  it('invitar es crítica: pide confirmación y devuelve el enlace sin enviar correo', async () => {
    const invitada = await abrirSesion(app, 'Invitada');
    const primera = await owner.herramienta('invitacion_crear', { correo: invitada.correo, rol: 'member' });
    expect(primera.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
    const r = await owner.herramienta('invitacion_crear', { correo: invitada.correo, rol: 'member' }, { confirmacion: primera.cuerpo.requiereConfirmacion.token });
    expect(r.cuerpo.ok).toBe(true);
    expect(r.cuerpo.datos).toMatchObject({ correo: invitada.correo, rol: 'member', estado: 'pending', vencida: false });
    expect(r.cuerpo.datos.ruta).toBe(`/invitacion/${r.cuerpo.datos.id}`);
    const lista = await owner.herramienta('invitaciones_listar', {});
    expect(lista.cuerpo.datos.invitaciones.map((i: any) => i.id)).toContain(r.cuerpo.datos.id);
    // aceptar por la ruta pública que sigue abierta
    const acepta = await invitada.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: r.cuerpo.datos.id });
    expect(acepta.estado).toBe(200);
    expect(await rolEn(empresaA, invitada)).toBe('member');
  });

  it('no se invita a quien ya es miembro ni se repite una invitación pendiente', async () => {
    const s = await abrirSesion(app, 'Repetida');
    await incorporar(owner, s, 'member');
    expect(codigo(await confirmada(owner, 'invitacion_crear', { correo: s.correo, rol: 'member' }))).toBe('conflicto');
    const otro = await abrirSesion(app, 'Pendiente');
    expect((await confirmada(owner, 'invitacion_crear', { correo: otro.correo, rol: 'member' })).cuerpo.ok).toBe(true);
    expect(codigo(await confirmada(owner, 'invitacion_crear', { correo: otro.correo.toUpperCase(), rol: 'admin' }))).toBe('conflicto');
  });

  it('no se invita como owner', async () => {
    const r = await owner.herramienta('invitacion_crear', { correo: 'x@prueba.pe', rol: 'owner' });
    expect(codigo(r)).toBe('argumentos_invalidos');
  });

  it('una invitación de la empresa A no sirve para la B', async () => {
    const s = await abrirSesion(app, 'Para A');
    const inv = await confirmada(owner, 'invitacion_crear', { correo: s.correo, rol: 'member' });
    const id = inv.cuerpo.datos.id as string;
    // el dueño de B no la ve ni la anula
    expect(codigo(await ajeno.herramienta('invitacion_anular', { invitacionId: id }))).toBe('no_encontrado');
    expect((await ajeno.herramienta('invitaciones_listar', {})).cuerpo.datos.invitaciones.map((i: any) => i.id)).not.toContain(id);
    // otra persona no puede usarla con su cuenta
    expect((await ajeno.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: id })).estado).toBeGreaterThanOrEqual(400);
    // y aceptarla pone a su destinataria en A, no en B
    expect((await s.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: id })).estado).toBe(200);
    expect(await rolEn(empresaA, s)).toBe('member');
    expect(await rolEn(empresaB, s)).toBeUndefined();
  });

  it('una invitación anulada no sirve, y una vencida tampoco', async () => {
    const s = await abrirSesion(app, 'Anulada');
    const inv = await confirmada(owner, 'invitacion_crear', { correo: s.correo, rol: 'member' });
    const id = inv.cuerpo.datos.id as string;
    expect((await owner.herramienta('invitacion_anular', { invitacionId: id })).cuerpo.ok).toBe(true);
    expect((await s.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: id })).estado).toBeGreaterThanOrEqual(400);
    expect(codigo(await owner.herramienta('invitacion_anular', { invitacionId: id }))).toBe('conflicto');
    expect(await rolEn(empresaA, s)).toBeUndefined();

    const v = await abrirSesion(app, 'Vencida');
    const inv2 = await confirmada(owner, 'invitacion_crear', { correo: v.correo, rol: 'member' });
    await auth.query("update auth.invitation set expires_at = now() - interval '1 day' where id = $1", [inv2.cuerpo.datos.id]);
    expect((await v.pedir('POST', '/api/auth/organization/accept-invitation', { invitationId: inv2.cuerpo.datos.id })).estado).toBeGreaterThanOrEqual(400);
    expect(await rolEn(empresaA, v)).toBeUndefined();
    const lista = await owner.herramienta('invitaciones_listar', {});
    expect(lista.cuerpo.datos.invitaciones.find((i: any) => i.id === inv2.cuerpo.datos.id).vencida).toBe(true);
  });
});

describe('permisos', () => {
  it('un member no puede usar ninguna de estas herramientas', async () => {
    const m = await abrirSesion(app, 'Sin poder');
    await incorporar(owner, m, 'member');
    const objetivo = owner.usuarioId;
    const llamadas: [string, Record<string, unknown>][] = [
      ['miembros_listar', {}],
      ['invitaciones_listar', {}],
      ['miembro_asignar_modulo', { personaId: m.usuarioId, modulo: 'registro', nivel: 'completo' }],
      ['miembro_cambiar_rol', { personaId: m.usuarioId, rol: 'admin' }],
      ['miembro_quitar', { personaId: objetivo }],
      ['invitacion_crear', { correo: 'a@prueba.pe', rol: 'member' }],
      ['invitacion_anular', { invitacionId: 'x' }],
    ];
    for (const [nombre, args] of llamadas) expect(codigo(await m.herramienta(nombre, args)), nombre).toBe('sin_permiso');
    expect(await rolEn(empresaA, m)).toBe('member');
  });

  it('empresa, persona y permisos no se aceptan como argumentos', async () => {
    expect(codigo(await owner.herramienta('miembro_quitar', { personaId: 'x', usuarioId: owner.usuarioId }))).toBe('argumento_prohibido');
    expect(codigo(await owner.herramienta('miembros_listar', { empresaId: empresaB }))).toBe('argumento_prohibido');
  });

  it('no hay forma de tocar el correo ni la contraseña de otra persona', async () => {
    const s = await abrirSesion(app, 'Cuenta global');
    await incorporar(owner, s, 'member');
    expect(codigo(await owner.herramienta('miembro_cambiar_rol', { personaId: s.usuarioId, rol: 'admin', correo: 'otro@prueba.pe' }))).toBe('argumentos_invalidos');
    expect(codigo(await owner.herramienta('miembro_cambiar_rol', { personaId: s.usuarioId, rol: 'admin', password: 'una-clave-larga-123' }))).toBe('argumentos_invalidos');
    for (const ruta of ['/api/auth/change-email', '/api/auth/admin/set-user-password', '/api/auth/update-user']) {
      expect((await owner.pedir('POST', ruta, { newEmail: 'otro@prueba.pe', userId: s.usuarioId })).estado).toBe(404);
    }
    const { rows } = await auth.query('select email from auth."user" where id = $1', [s.usuarioId]);
    expect(rows[0].email).toBe(s.correo);
  });
});

describe('roles y último propietario', () => {
  it('no se degrada ni se quita al último propietario', async () => {
    expect(codigo(await owner.herramienta('miembro_cambiar_rol', { personaId: owner.usuarioId, rol: 'admin' }))).toBe('conflicto');
    expect(codigo(await owner.herramienta('miembro_quitar', { personaId: owner.usuarioId }))).toBe('conflicto');
    expect(await rolEn(empresaA, owner)).toBe('owner');
  });

  it('un admin no cambia ni quita a un owner, ni nombra owners', async () => {
    const a = await abrirSesion(app, 'Admin');
    await incorporar(owner, a, 'admin');
    const m = await abrirSesion(app, 'Miembro');
    await incorporar(owner, m, 'member');
    expect(codigo(await a.herramienta('miembro_cambiar_rol', { personaId: owner.usuarioId, rol: 'member' }))).toBe('sin_permiso');
    expect(codigo(await a.herramienta('miembro_quitar', { personaId: owner.usuarioId }))).toBe('sin_permiso');
    expect(codigo(await a.herramienta('miembro_cambiar_rol', { personaId: m.usuarioId, rol: 'owner' }))).toBe('sin_permiso');
    // sí gestiona miembros
    expect((await confirmada(a, 'miembro_cambiar_rol', { personaId: m.usuarioId, rol: 'admin' })).cuerpo.ok).toBe(true);
    expect(await rolEn(empresaA, m)).toBe('admin');
    expect(await rolEn(empresaA, owner)).toBe('owner');
  });

  it('con otro propietario, el primero sí puede dejar de serlo', async () => {
    const o2 = await abrirSesion(app, 'Segundo dueño');
    await incorporar(owner, o2, 'admin');
    expect((await confirmada(owner, 'miembro_cambiar_rol', { personaId: o2.usuarioId, rol: 'owner' })).cuerpo.ok).toBe(true);
    expect(await rolEn(empresaA, o2)).toBe('owner');
    expect((await confirmada(o2, 'miembro_cambiar_rol', { personaId: o2.usuarioId, rol: 'admin' })).cuerpo.ok).toBe(true);
    expect(await rolEn(empresaA, o2)).toBe('admin');
  });
});

describe('módulos asignados y quitar', () => {
  it('asignar lectura deja entrar pero no escribir; sin_acceso lo retira; admin y no contratados se rechazan', async () => {
    const m = await abrirSesion(app, 'Con lectura');
    await incorporar(owner, m, 'member');
    const antes = await m.pedir('GET', '/api/v1/yo');
    expect(antes.cuerpo.datos.modulos.find((x: any) => x.codigo === 'registro').acceso).toMatchObject({ puedeEntrar: false });
    const r = await owner.herramienta('miembro_asignar_modulo', { personaId: m.usuarioId, modulo: 'registro', nivel: 'lectura' });
    expect(r.cuerpo.datos).toEqual({ personaId: m.usuarioId, modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
    const despues = await m.pedir('GET', '/api/v1/yo');
    expect(despues.cuerpo.datos.modulos.find((x: any) => x.codigo === 'registro').acceso).toMatchObject({ puedeEntrar: true, puedeEscribir: false, nivel: 'lectura' });
    const lista = await owner.herramienta('miembros_listar', {});
    expect(lista.cuerpo.datos.miembros.find((x: any) => x.personaId === m.usuarioId).modulos).toEqual([{ modulo: 'registro', nivel: 'lectura', alcance: 'todos' }]);
    expect(codigo(await owner.herramienta('miembro_asignar_modulo', { personaId: m.usuarioId, modulo: 'cotizador', nivel: 'lectura' }))).toBe('no_encontrado');
    expect(codigo(await owner.herramienta('miembro_asignar_modulo', { personaId: owner.usuarioId, modulo: 'registro', nivel: 'lectura' }))).toBe('conflicto');
    expect(codigo(await owner.herramienta('miembro_asignar_modulo', { personaId: ajeno.usuarioId, modulo: 'registro', nivel: 'lectura' }))).toBe('no_encontrado');
    await owner.herramienta('miembro_asignar_modulo', { personaId: m.usuarioId, modulo: 'registro', nivel: 'sin_acceso' });
    const fin = await m.pedir('GET', '/api/v1/yo');
    expect(fin.cuerpo.datos.modulos.find((x: any) => x.codigo === 'registro').acceso).toMatchObject({ puedeEntrar: false });
  });

  it('quitar a un miembro le retira el acceso, borra sus asignaciones y deja auditoría sin el correo', async () => {
    const m = await abrirSesion(app, 'Se va');
    await incorporar(owner, m, 'member');
    await owner.herramienta('miembro_asignar_modulo', { personaId: m.usuarioId, modulo: 'registro', nivel: 'completo' });
    expect((await confirmada(owner, 'miembro_quitar', { personaId: m.usuarioId })).cuerpo.ok).toBe(true);
    expect(await rolEn(empresaA, m)).toBeUndefined();
    const filas = await comoEmpresa(appPool, empresaA, async (c) => (await c.query('select count(*)::int as n from core.usuario_modulos where usuario_id = $1', [m.usuarioId])).rows);
    expect(filas[0].n).toBe(0);
    expect((await m.herramienta('miembros_listar', {})).cuerpo.ok).toBe(false);
    const aud = await comoEmpresa(appPool, empresaA, async (c) => (await c.query("select * from core.auditoria where herramienta = 'miembro_quitar' order by creado_en")).rows as Record<string, any>[]);
    expect(aud.some((f) => f.resultado === 'ok')).toBe(true);
    expect(JSON.stringify(aud)).not.toContain(m.correo);
    // y la cuenta sigue existiendo (es global)
    expect((await auth.query('select 1 from auth."user" where id = $1', [m.usuarioId])).rowCount).toBe(1);
  });
});

describe('max_usuarios', () => {
  it('no deja invitar cuando miembros e invitaciones pendientes llenan el tope', async () => {
    const dueno = await abrirSesion(app, 'Dueña C');
    const empresaC = await crearEmpresa(dueno, 'Empresa C');
    const lista = await dueno.herramienta('miembros_listar', {});
    expect(lista.cuerpo.datos).toMatchObject({ limiteDeUsuarios: null, invitacionesPendientes: 0 });
    const sistema = abrirPool('sistema');
    try {
      const u = await sistema.query("update core.empresa_modulos set max_usuarios = 2 where tenant_id = $1 and modulo = 'registro'", [empresaC]);
      expect(u.rowCount).toBe(1);
    } finally {
      await sistema.end();
    }
    const uno = await abrirSesion(app, 'Uno');
    expect((await confirmada(dueno, 'invitacion_crear', { correo: uno.correo, rol: 'member' })).cuerpo.ok).toBe(true);
    const dos = await abrirSesion(app, 'Dos');
    const r = await confirmada(dueno, 'invitacion_crear', { correo: dos.correo, rol: 'member' });
    expect(codigo(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toContain('2');
    expect((await dueno.herramienta('miembros_listar', {})).cuerpo.datos).toMatchObject({ limiteDeUsuarios: 2, invitacionesPendientes: 1 });
  });
});
