import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, CLAVE_DE_PRUEBA, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';

// Consola de plataforma por HTTP real (fase 9a): lista blanca de operadores, rol de plataforma,
// confirmación de lo crítico, auditoría y efecto en la empresa. Todo contra la base local de pruebas.

let app: AppDePruebas;
let sistema: pg.Pool;
let appPool: pg.Pool;
let operador: Sesion; // en core.plataforma_admins
let normal: Sesion; // dueño de una empresa, NO operador
let empresa: string;

const plat = (s: Sesion, nombre: string, args?: unknown, confirmacion?: string) =>
  s.pedir('POST', `/api/v1/plataforma/herramientas/${nombre}`, { ...(args !== undefined && { args }), ...(confirmacion && { confirmacion }) });
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;

/** Pide, confirma con el token recibido y devuelve la respuesta final. */
async function critica(s: Sesion, nombre: string, args: unknown) {
  const pedido = await plat(s, nombre, args);
  expect(pedido.estado).toBe(200);
  expect(pedido.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String) } });
  return plat(s, nombre, args, pedido.cuerpo.requiereConfirmacion.token);
}

const moduloDeYo = async (s: Sesion, cod: string) => {
  const yo = await s.pedir('GET', '/api/v1/yo');
  return (yo.cuerpo.datos.modulos as any[]).find((m) => m.codigo === cod);
};
const auditoria = async (actor: string) =>
  (await sistema.query('select herramienta, empresa_id, resultado, codigo, resumen from core.auditoria_plataforma where actor_usuario_id = $1 order by creado_en, id', [actor])).rows as Record<string, any>[];

beforeAll(async () => {
  app = await levantarApp();
  sistema = abrirPool('sistema');
  appPool = abrirPool('app');
  operador = await abrirSesion(app, 'Operador');
  await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [operador.usuarioId]);
  normal = await abrirSesion(app, 'Dueña');
  empresa = await crearEmpresa(normal, 'Imprenta Plataforma');
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([sistema.end(), appPool.end()]);
});

describe('acceso: lista blanca de operadores', () => {
  it('sin sesión responde no_autenticado', async () => {
    const r = await fetch(`${app.url}/api/v1/plataforma/herramientas/plataforma_empresas_listar`, { method: 'POST', headers: { origin: app.origen, 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(401);
  });

  it('un usuario normal recibe sin_permiso en toda ruta de plataforma, existan o no', async () => {
    for (const n of ['plataforma_empresas_listar', 'plataforma_modulo_activar', 'plataforma_restablecer_contrasena', 'no_existe']) {
      const r = await plat(normal, n, {});
      expect(r.estado, n).toBe(403);
      expect(codigo(r), n).toBe('sin_permiso');
    }
    const g = await normal.pedir('GET', '/api/v1/plataforma/herramientas/plataforma_empresas_listar');
    expect([403, 404]).toContain(g.estado);
  });

  it('las herramientas de plataforma no corren por la puerta de las empresas, ni siquiera para un operador', async () => {
    expect(codigo(await normal.herramienta('plataforma_empresas_listar', {}))).toBe('sin_permiso');
    // Un operador sin empresa ni siquiera llega; con empresa, la puerta cerrada responde sin_permiso.
    expect(codigo(await operador.herramienta('plataforma_empresas_listar', {}))).toBe('sin_empresa');
    const dual = await abrirSesion(app, 'Operadora con empresa');
    await crearEmpresa(dual, 'Empresa de operadora');
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [dual.usuarioId]);
    expect(codigo(await dual.herramienta('plataforma_empresas_listar', {}))).toBe('sin_permiso');
  });

  it('quitar al operador de la lista le corta el acceso en la siguiente petición', async () => {
    const otro = await abrirSesion(app, 'Operador temporal');
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [otro.usuarioId]);
    expect((await plat(otro, 'plataforma_empresas_listar', {})).estado).toBe(200);
    await sistema.query('delete from core.plataforma_admins where usuario_id = $1', [otro.usuarioId]);
    expect(codigo(await plat(otro, 'plataforma_empresas_listar', {}))).toBe('sin_permiso');
  });

  it('exige el origen de Capaz', async () => {
    const r = await operador.pedir('POST', '/api/v1/plataforma/herramientas/plataforma_empresas_listar', { args: {} }, { origin: 'http://malo.example' });
    expect(codigo(r)).toBe('origen_invalido');
  });
});

describe('lectura: contratos y cifras, nunca datos de negocio', () => {
  it('lista las empresas y muestra la ficha con módulos, miembros e historial', async () => {
    const lista = await plat(operador, 'plataforma_empresas_listar', { texto: 'plataforma' });
    expect(lista.cuerpo.datos.items.map((e: any) => e.id)).toContain(empresa);
    const ficha = await plat(operador, 'plataforma_empresas_ver', { empresa });
    expect(ficha.estado).toBe(200);
    expect(ficha.cuerpo.datos).toMatchObject({ id: empresa, nombre: 'Imprenta Plataforma', miembros: 1 });
    expect(Object.keys(ficha.cuerpo.datos).sort()).toEqual(['altaEn', 'historial', 'id', 'miembros', 'modulos', 'nombre', 'ultimaActividadEn']);
  });

  it('una empresa que no existe responde no_encontrado; empresaId no es un argumento', async () => {
    expect(codigo(await plat(operador, 'plataforma_empresas_ver', { empresa: 'no-existe' }))).toBe('no_encontrado');
    expect(codigo(await plat(operador, 'plataforma_empresas_ver', { empresaId: empresa }))).toBe('argumento_prohibido');
  });
});

describe('contratación: módulo a una empresa por HTTP', () => {
  it('da el módulo crm en prueba de 15 días y su `yo` lo refleja; todo queda auditado con el actor', async () => {
    expect((await moduloDeYo(normal, 'crm'))?.acceso?.puedeEntrar ?? false).toBe(false);
    const r = await critica(operador, 'plataforma_modulo_activar', { empresa, modulo: 'crm', pruebaDias: 15 });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos).toMatchObject({ empresa, modulo: 'crm', estado: 'prueba' });
    const crm = await moduloDeYo(normal, 'crm');
    expect(crm.acceso).toMatchObject({ puedeEntrar: true, motivo: 'prueba' });
    const { rows } = await sistema.query(`select actor, estado_nuevo from core.empresa_modulos_eventos where tenant_id = $1 and modulo = 'crm'`, [empresa]);
    expect(rows).toEqual([{ actor: `plataforma:${operador.usuarioId}`, estado_nuevo: 'prueba' }]);
    const a = (await auditoria(operador.usuarioId)).filter((f) => f.herramienta === 'plataforma_modulo_activar');
    expect(a.map((f) => f.resultado)).toEqual(['rechazada', 'ok']); // el pedido de confirmación y la ejecución
    expect(a[1]).toMatchObject({ empresa_id: empresa, codigo: null });
  });

  it('una confirmación sirve una sola vez y solo para esos argumentos', async () => {
    const args = { empresa, modulo: 'crm', motivo: 'pausa' };
    const pedido = await plat(operador, 'plataforma_modulo_suspender', args);
    const token = pedido.cuerpo.requiereConfirmacion.token as string;
    expect(codigo(await plat(operador, 'plataforma_modulo_suspender', { ...args, motivo: 'otra' }, token))).toBe('confirmacion_no_coincide');
    expect((await plat(operador, 'plataforma_modulo_suspender', args, token)).cuerpo.datos.estado).toBe('suspendido');
    expect(codigo(await plat(operador, 'plataforma_modulo_suspender', args, token))).toBe('confirmacion_ya_usada');
    expect(codigo(await plat(operador, 'plataforma_modulo_suspender', args, 'basura'))).toBe('confirmacion_invalida');
  });

  it('la confirmación de un operador no vale para otro', async () => {
    const otro = await abrirSesion(app, 'Otro operador');
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [otro.usuarioId]);
    const args = { empresa, modulo: 'crm' };
    const pedido = await plat(operador, 'plataforma_modulo_reactivar', args);
    expect(codigo(await plat(otro, 'plataforma_modulo_reactivar', args, pedido.cuerpo.requiereConfirmacion.token))).toBe('confirmacion_no_coincide');
  });

  it('reactivar y dar de baja: la baja deja a la empresa en solo lectura', async () => {
    expect((await critica(operador, 'plataforma_modulo_reactivar', { empresa, modulo: 'crm' })).cuerpo.datos.estado).toBe('activo');
    expect((await moduloDeYo(normal, 'crm')).acceso.puedeEscribir).toBe(true);
    const baja = await critica(operador, 'plataforma_modulo_dar_de_baja', { empresa, modulo: 'crm', motivo: 'cancelación' });
    expect(baja.cuerpo.datos.estado).toBe('baja');
    const crm = await moduloDeYo(normal, 'crm');
    expect(crm.acceso.puedeEscribir).toBe(false);
    await expect(comoEmpresa(appPool, empresa, (c) => c.query(`select core.exigir_modulo('crm')`))).rejects.toThrow(/no está activo/);
    const { rows } = await sistema.query(`select evento from core.empresa_modulos_eventos where tenant_id = $1 and modulo = 'crm' order by creado_en, id`, [empresa]);
    expect(rows.map((r) => r.evento)).toEqual(['prueba', 'suspension', 'reactivacion', 'baja']);
  });

  it('un módulo que no existe o sin cumplir su dependencia responde conflicto, sin cambios', async () => {
    const r = await critica(operador, 'plataforma_modulo_activar', { empresa, modulo: 'no_existe' });
    expect(codigo(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toMatch(/no existe o no está disponible/);
  });

  it('fija plan, precio, vigencia y límite; un plan inexistente se rechaza', async () => {
    const plan = await critica(operador, 'plataforma_planes_guardar', { codigo: 'basico_p', nombre: 'Básico', precioCentimos: 9900, usuariosIncluidos: 5, modulos: ['crm', 'registro'] });
    expect(plan.cuerpo.datos).toMatchObject({ codigo: 'basico_p', precioCentimos: 9900, modulos: ['crm', 'registro'] });
    expect((await plat(operador, 'plataforma_planes_listar', {})).cuerpo.datos.items.map((p: any) => p.codigo)).toContain('basico_p');
    expect(codigo(await critica(operador, 'plataforma_planes_guardar', { codigo: 'malo_p', nombre: 'Malo', precioCentimos: 1, modulos: ['no_existe'] }))).toBe('argumentos_invalidos');
    const fijado = await critica(operador, 'plataforma_contrato_fijar', { empresa, modulo: 'crm', plan: 'basico_p', precioAcordadoCentimos: 7500, vigenteHasta: '2027-12-31T00:00:00Z', maxUsuarios: 3 });
    expect(fijado.cuerpo.datos).toMatchObject({ plan: 'basico_p', precioAcordadoCentimos: 7500, maxUsuarios: 3 });
    expect(codigo(await critica(operador, 'plataforma_contrato_fijar', { empresa, modulo: 'crm', plan: 'no_hay' }))).toBe('argumentos_invalidos');
    const ficha = (await plat(operador, 'plataforma_empresas_ver', { empresa })).cuerpo.datos;
    expect(ficha.modulos.find((m: any) => m.modulo === 'crm')).toMatchObject({ plan: 'basico_p', precioAcordadoCentimos: 7500 });
    // Sin ningún dato de contrato, el esquema lo rechaza.
    expect(codigo(await plat(operador, 'plataforma_contrato_fijar', { empresa, modulo: 'crm' }))).toBe('argumentos_invalidos');
  });
});

describe('solicitudes, empresas y cuentas', () => {
  it('lista y atiende una solicitud de módulo hecha por la empresa', async () => {
    await comoEmpresa(appPool, empresa, (c) => c.query(`insert into core.solicitudes_modulo (tenant_id, modulo, usuario_id, nota) values ($1, 'compras', $2, 'lo necesitamos')`, [empresa, normal.usuarioId]), { confirmar: true });
    const lista = await plat(operador, 'plataforma_solicitudes_listar', {});
    const s = lista.cuerpo.datos.items.find((x: any) => x.empresa === empresa);
    expect(s).toMatchObject({ modulo: 'compras', estado: 'pendiente', empresaNombre: 'Imprenta Plataforma' });
    const r = await critica(operador, 'plataforma_solicitud_atender', { id: s.id, resultado: 'atendida' });
    expect(r.cuerpo.datos).toMatchObject({ estado: 'atendida', atendidoEn: expect.any(String) });
    expect(codigo(await critica(operador, 'plataforma_solicitud_atender', { id: s.id, resultado: 'descartada' }))).toBe('conflicto');
  });

  it('crea una empresa para una persona ya registrada, con sus módulos por defecto', async () => {
    const futura = await abrirSesion(app, 'Futura dueña');
    const r = await critica(operador, 'plataforma_empresas_crear', { nombre: 'Taller Nuevo', correoDelDueno: futura.correo.toUpperCase() });
    expect(r.estado).toBe(200);
    const id = r.cuerpo.datos.id as string;
    const yo = await futura.pedir('GET', '/api/v1/yo');
    expect(yo.cuerpo.datos.empresas.map((e: any) => e.id)).toContain(id);
    expect(codigo(await plat(operador, 'plataforma_empresas_crear', { nombre: 'Sin dueña', correoDelDueno: 'nadie@no.pe' }))).toBe('no_encontrado');
  });

  it('restablece una contraseña: el enlace sirve una vez y no queda en la auditoría', async () => {
    const victima = await abrirSesion(app, 'Olvidadiza');
    const r = await critica(operador, 'plataforma_restablecer_contrasena', { correo: victima.correo });
    expect(r.estado).toBe(200);
    const enlace = new URL(r.cuerpo.datos.enlace as string);
    const token = enlace.pathname.split('/').pop()!;
    const nueva = 'una-clave-nueva-123';
    expect((await victima.pedir('POST', '/api/auth/reset-password', { newPassword: nueva, token })).estado).toBe(200);
    expect((await victima.pedir('POST', '/api/auth/reset-password', { newPassword: nueva, token })).estado).toBe(400);
    const entrada = await victima.pedir('POST', '/api/auth/sign-in/email', { email: victima.correo, password: nueva });
    expect(entrada.estado).toBe(200);
    expect((await victima.pedir('POST', '/api/auth/sign-in/email', { email: victima.correo, password: CLAVE_DE_PRUEBA })).estado).not.toBe(200);
    const texto = JSON.stringify(await auditoria(operador.usuarioId));
    expect(texto).not.toContain(token);
    expect(texto).not.toContain('reset-password');
    expect(codigo(await plat(operador, 'plataforma_restablecer_contrasena', { correo: 'nadie@no.pe' }))).toBe('no_encontrado');
  });
});

describe('restablecer contraseña y otros operadores', () => {
  it('rechaza la cuenta de OTRO operador (con aviso y auditoría) y permite la de quien no lo es', async () => {
    const colega = await abrirSesion(app, 'Colega operador');
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [colega.usuarioId]);
    const antes = (await auditoria(operador.usuarioId)).length;
    const pedido = await plat(operador, 'plataforma_restablecer_contrasena', { correo: colega.correo });
    expect(pedido.estado).toBe(403);
    expect(pedido.cuerpo).toMatchObject({ ok: false, error: { codigo: 'sin_permiso', mensaje: expect.stringContaining('otro operador') } });
    expect(pedido.cuerpo.requiereConfirmacion).toBeUndefined();
    const filas = await auditoria(operador.usuarioId);
    expect(filas.length).toBe(antes + 1);
    expect(filas.at(-1)).toMatchObject({ herramienta: 'plataforma_restablecer_contrasena', resultado: 'rechazada', codigo: 'sin_permiso' });
    // La contraseña del colega no cambió.
    expect((await colega.pedir('POST', '/api/auth/sign-in/email', { email: colega.correo, password: CLAVE_DE_PRUEBA })).estado).toBe(200);
    // Quien no es operador sigue pudiendo restablecerse.
    const r = await critica(operador, 'plataforma_restablecer_contrasena', { correo: normal.correo });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.ok).toBe(true);
  });
});

describe('auditoría de plataforma', () => {
  it('deja cada acción con su actor, y los rechazos como rechazada; no se puede editar', async () => {
    const filas = await auditoria(operador.usuarioId);
    expect(filas.some((f) => f.resultado === 'ok' && f.herramienta === 'plataforma_empresas_listar')).toBe(true);
    expect(filas.some((f) => f.resultado === 'rechazada' && f.codigo === 'argumento_prohibido')).toBe(true);
    expect(filas.some((f) => f.resultado === 'rechazada' && f.codigo === 'confirmacion_ya_usada')).toBe(true);
    // El usuario normal nunca escribe en la auditoría de plataforma.
    expect(await auditoria(normal.usuarioId)).toEqual([]);
    await expect(sistema.query(`update core.auditoria_plataforma set resultado = 'ok'`)).rejects.toThrow();
    await expect(sistema.query('delete from core.auditoria_plataforma')).rejects.toThrow();
  });
});
