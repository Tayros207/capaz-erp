import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';

// Carril P3a: estado de cuenta, catálogo de módulos, alta guiada y vencimientos, por HTTP real.

let app: AppDePruebas;
let sistema: pg.Pool;
let appPool: pg.Pool;
let operador: Sesion;
let normal: Sesion;
let empresa: string;
let otra: string;

const plat = (s: Sesion, nombre: string, args?: unknown, confirmacion?: string) =>
  s.pedir('POST', `/api/v1/plataforma/herramientas/${nombre}`, { ...(args !== undefined && { args }), ...(confirmacion && { confirmacion }) });
const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
async function critica(s: Sesion, nombre: string, args: unknown) {
  const pedido = await plat(s, nombre, args);
  if (!pedido.cuerpo?.requiereConfirmacion) return pedido;
  return plat(s, nombre, args, pedido.cuerpo.requiereConfirmacion.token);
}
const eventos = async (id: string) =>
  (await sistema.query('select evento, estado_anterior, estado_nuevo, actor from core.empresa_cuenta_eventos where tenant_id = $1 order by creado_en, id', [id])).rows;
const escribe = (id: string) => comoEmpresa(appPool, id, (c) => c.query(`select core.exigir_modulo('crm')`));

beforeAll(async () => {
  app = await levantarApp();
  sistema = abrirPool('sistema');
  appPool = abrirPool('app');
  operador = await abrirSesion(app, 'Operador P3a');
  await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [operador.usuarioId]);
  normal = await abrirSesion(app, 'Dueña P3a');
  empresa = await crearEmpresa(normal, 'Imprenta Cuenta');
  otra = await crearEmpresa(normal, 'Imprenta Aparte');
  await activarModulo(empresa, 'crm');
  await activarModulo(otra, 'crm');
});
afterAll(async () => {
  await app.cerrar();
  await Promise.all([sistema.end(), appPool.end()]);
});

describe('estado de cuenta', () => {
  it('un usuario normal recibe sin_permiso en las herramientas nuevas', async () => {
    for (const n of ['plataforma_cuenta_pausar', 'plataforma_cuenta_dar_de_baja', 'plataforma_cuenta_reactivar', 'plataforma_modulos_listar', 'plataforma_vencimientos_listar']) {
      const r = await plat(normal, n, { empresa, motivo: 'no debería' });
      expect(r.estado, n).toBe(403);
      expect(codigo(r), n).toBe('sin_permiso');
    }
  });

  it('pausar: escribe antes, no después; lee siempre; no toca los módulos; el motivo exige 5 caracteres', async () => {
    await expect(escribe(empresa)).resolves.toBeDefined();
    const modulosAntes = (await sistema.query('select modulo, estado from core.empresa_modulos where tenant_id = $1 order by modulo', [empresa])).rows;
    expect(codigo(await plat(operador, 'plataforma_cuenta_pausar', { empresa, motivo: 'mora' }))).toBe('argumentos_invalidos');
    const pedido = await plat(operador, 'plataforma_cuenta_pausar', { empresa, motivo: 'mora de dos meses' });
    expect(pedido.cuerpo.requiereConfirmacion.resumen).toMatch(/Pausar la cuenta de «Imprenta Cuenta»/);
    const r = await plat(operador, 'plataforma_cuenta_pausar', { empresa, motivo: 'mora de dos meses' }, pedido.cuerpo.requiereConfirmacion.token);
    expect(r.cuerpo.datos).toMatchObject({ empresa, estadoCuenta: 'pausada', motivoCuenta: 'mora de dos meses' });
    await expect(escribe(empresa)).rejects.toThrow(/no está activo/);
    expect((await normal.pedir('GET', '/api/v1/yo')).estado).toBe(200); // la lectura sigue
    expect((await sistema.query('select modulo, estado from core.empresa_modulos where tenant_id = $1 order by modulo', [empresa])).rows).toEqual(modulosAntes);
    // Aislamiento: la otra empresa sigue escribiendo.
    await expect(escribe(otra)).resolves.toBeDefined();
  });

  it('confirmación de un solo uso ligada a los argumentos', async () => {
    const args = { empresa: otra, motivo: 'prueba de token' };
    const pedido = await plat(operador, 'plataforma_cuenta_pausar', args);
    const token = pedido.cuerpo.requiereConfirmacion.token as string;
    expect(codigo(await plat(operador, 'plataforma_cuenta_pausar', { ...args, motivo: 'otro motivo' }, token))).toBe('confirmacion_no_coincide');
    expect((await plat(operador, 'plataforma_cuenta_pausar', args, token)).cuerpo.datos.estadoCuenta).toBe('pausada');
    expect(codigo(await plat(operador, 'plataforma_cuenta_pausar', args, token))).toBe('confirmacion_ya_usada');
    await critica(operador, 'plataforma_cuenta_reactivar', { empresa: otra });
  });

  it('pausar una cuenta ya pausada no duplica eventos; la ficha y la lista muestran estado e historial', async () => {
    const antes = (await eventos(empresa)).length;
    await critica(operador, 'plataforma_cuenta_pausar', { empresa, motivo: 'mora de dos meses' });
    expect((await eventos(empresa)).length).toBe(antes);
    const ficha = (await plat(operador, 'plataforma_empresas_ver', { empresa })).cuerpo.datos;
    expect(ficha).toMatchObject({ estadoCuenta: 'pausada', motivoCuenta: 'mora de dos meses' });
    expect(ficha.eventosDeCuenta[0]).toMatchObject({ evento: 'pausa', estadoNuevo: 'pausada', actor: `plataforma:${operador.usuarioId}` });
    expect(ficha.modulos.find((m: any) => m.modulo === 'crm').nombre).toBeTruthy();
    const lista = (await plat(operador, 'plataforma_empresas_listar', { texto: 'imprenta' })).cuerpo.datos.items;
    expect(lista.find((e: any) => e.id === empresa).estadoCuenta).toBe('pausada');
    expect(lista.find((e: any) => e.id === otra).estadoCuenta).toBe('activa');
    expect(lista.find((e: any) => e.id === empresa).modulos[0].nombre).not.toBe('');
  });

  it('reactivar devuelve la escritura; dar de baja no borra nada y el historial queda completo', async () => {
    expect((await critica(operador, 'plataforma_cuenta_reactivar', { empresa })).cuerpo.datos.estadoCuenta).toBe('activa');
    await expect(escribe(empresa)).resolves.toBeDefined();
    const filas = async () => (await sistema.query('select (select count(*) from core.empresa_modulos where tenant_id = $1)::int as m, (select count(*) from core.auditoria where tenant_id = $1)::int as a', [empresa])).rows[0];
    const antes = await filas();
    expect(codigo(await plat(operador, 'plataforma_cuenta_dar_de_baja', { empresa, motivo: '  ' }))).toBe('argumentos_invalidos');
    const baja = await critica(operador, 'plataforma_cuenta_dar_de_baja', { empresa, motivo: 'cancelación del servicio' });
    expect(baja.cuerpo.datos.estadoCuenta).toBe('baja');
    expect(await filas()).toEqual(antes);
    await critica(operador, 'plataforma_cuenta_reactivar', { empresa, motivo: 'volvió' });
    expect((await eventos(empresa)).map((e) => e.evento)).toEqual(['alta', 'pausa', 'reactivacion', 'baja', 'reactivacion']);
    const actores = new Set((await eventos(empresa)).slice(1).map((e) => e.actor));
    expect([...actores]).toEqual([`plataforma:${operador.usuarioId}`]);
  });

  it('regla 7: no se pausa ni se da de baja una cuenta con un operador entre sus miembros', async () => {
    const dual = await abrirSesion(app, 'Operadora dueña');
    const propia = await crearEmpresa(dual, 'Empresa de la plataforma');
    await sistema.query('insert into core.plataforma_admins (usuario_id) values ($1)', [dual.usuarioId]);
    for (const n of ['plataforma_cuenta_pausar', 'plataforma_cuenta_dar_de_baja']) {
      const r = await plat(operador, n, { empresa: propia, motivo: 'intento de pausa' });
      expect(codigo(r), n).toBe('conflicto');
      expect(r.cuerpo.error.mensaje).toBe('Esta cuenta es de la plataforma y no se puede pausar.');
      expect(r.cuerpo.requiereConfirmacion).toBeUndefined();
    }
    expect(((await sistema.query('select estado from core.empresa_cuenta where tenant_id = $1', [propia])).rows[0] ?? { estado: 'activa' }).estado).toBe('activa');
  });
});

describe('módulos con nombre (A5)', () => {
  it('lista el catálogo con nombre, familia y bandera de construcción', async () => {
    const items = (await plat(operador, 'plataforma_modulos_listar', {})).cuerpo.datos.items as any[];
    const cot = items.find((m) => m.codigo === 'cotizador');
    expect(cot).toMatchObject({ enConstruccion: true, nombre: expect.any(String), familia: expect.any(String), descripcion: expect.any(String) });
    expect(items.find((m) => m.codigo === 'compras').dependeDe).toEqual(['insumos']);
    expect(items.some((m) => m.codigo === 'core')).toBe(false);
  });
});

describe('alta guiada (A6)', () => {
  it('con plan: crea la empresa, aplica el plan, cuenta activa, todo auditado', async () => {
    await critica(operador, 'plataforma_planes_guardar', { codigo: 'p3a_plan', nombre: 'Plan P3a', precioCentimos: 5000, modulos: ['insumos', 'compras'] });
    const futura = await abrirSesion(app, 'Futura P3a');
    const args = { nombre: 'Taller Guiado', correoDelDueno: futura.correo, plan: 'p3a_plan' };
    const pedido = await plat(operador, 'plataforma_empresas_crear', args);
    expect(pedido.cuerpo.requiereConfirmacion.resumen).toMatch(/plan «p3a_plan»/);
    const r = await plat(operador, 'plataforma_empresas_crear', args, pedido.cuerpo.requiereConfirmacion.token);
    expect(r.cuerpo.datos).toMatchObject({ nombre: 'Taller Guiado', plan: 'p3a_plan', estadoCuenta: 'activa' });
    expect(r.cuerpo.datos.modulos.map((m: any) => m.modulo)).toEqual(['insumos', 'compras']);
    const id = r.cuerpo.datos.id as string;
    const { rows } = await sistema.query('select modulo, estado, plan from core.empresa_modulos where tenant_id = $1 order by modulo', [id]);
    expect(rows).toEqual([{ modulo: 'compras', estado: 'activo', plan: 'p3a_plan' }, { modulo: 'insumos', estado: 'activo', plan: 'p3a_plan' }]);
    expect((await eventos(id)).map((e) => [e.evento, e.actor])).toEqual([['alta', `plataforma:${operador.usuarioId}`]]);
    const aud = await sistema.query(`select resumen from core.auditoria_plataforma where herramienta = 'plataforma_empresas_crear' and empresa_id = $1 and resultado = 'ok'`, [id]);
    expect(aud.rows[0].resumen).toMatchObject({ plan: 'p3a_plan', modulos: 'insumos,compras', estadoCuenta: 'activa' });
  });

  it('pidiendo un módulo con dependencia, activa la dependencia y la marca', async () => {
    const futura = await abrirSesion(app, 'Futura dos');
    const r = await critica(operador, 'plataforma_empresas_crear', { nombre: 'Taller Dos', correoDelDueno: futura.correo, modulos: [{ codigo: 'compras', pruebaDias: 10 }] });
    expect(r.cuerpo.datos.modulos).toMatchObject([
      { modulo: 'insumos', estado: 'prueba', porDependencia: true },
      { modulo: 'compras', estado: 'prueba', porDependencia: false },
    ]);
  });

  it('rechaza módulo en construcción, módulo o plan inexistente sin crear la empresa', async () => {
    const futura = await abrirSesion(app, 'Futura tres');
    const antes = (await sistema.query('select count(*)::int as n from core.v_empresas_plataforma')).rows[0].n;
    expect(codigo(await plat(operador, 'plataforma_empresas_crear', { nombre: 'Taller Tres', correoDelDueno: futura.correo, modulos: [{ codigo: 'cotizador' }] }))).toBe('argumentos_invalidos');
    expect(codigo(await plat(operador, 'plataforma_empresas_crear', { nombre: 'Taller Tres', correoDelDueno: futura.correo, modulos: [{ codigo: 'no_existe' }] }))).toBe('argumentos_invalidos');
    expect(codigo(await plat(operador, 'plataforma_empresas_crear', { nombre: 'Taller Tres', correoDelDueno: futura.correo, plan: 'no_hay' }))).toBe('argumentos_invalidos');
    expect((await sistema.query('select count(*)::int as n from core.v_empresas_plataforma')).rows[0].n).toBe(antes);
  });
});

describe('vencimientos (A7)', () => {
  it('lista pruebas y contratos que vencen, con ingresos acordados, sin datos de negocio', async () => {
    const dias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
    await sistema.query(`select core.activar_modulo($1, 'insumos', 5, 'pruebas')`, [otra]);
    await sistema.query(`update core.empresa_modulos set precio_acordado_centimos = 3000 where tenant_id = $1 and modulo = 'insumos'`, [otra]);
    await sistema.query(`update core.empresa_modulos set precio_acordado_centimos = 7500, vigente_hasta = $2 where tenant_id = $1 and modulo = 'crm'`, [otra, dias(20)]);
    const r = (await plat(operador, 'plataforma_vencimientos_listar', {})).cuerpo.datos;
    expect(r.dias).toBe(14);
    const mios = r.items.filter((i: any) => i.empresa === otra && i.modulo === 'insumos');
    expect(mios).toMatchObject([{ modulo: 'insumos', tipo: 'prueba', diasRestantes: expect.any(Number), precioAcordadoCentimos: 3000, empresaNombre: 'Imprenta Aparte', moduloNombre: expect.any(String) }]);
    expect(mios[0].diasRestantes).toBeGreaterThanOrEqual(4);
    expect(mios[0].diasRestantes).toBeLessThanOrEqual(5);
    const amplio = (await plat(operador, 'plataforma_vencimientos_listar', { dias: 30 })).cuerpo.datos;
    expect(amplio.items.filter((i: any) => i.empresa === otra && ['crm', 'insumos'].includes(i.modulo)).map((i: any) => i.tipo).sort()).toEqual(['contrato', 'prueba']);
    expect(amplio.porEmpresa.find((e: any) => e.empresa === otra).ingresoMensualAcordadoCentimos).toBe(10500);
    expect(amplio.ingresoMensualAcordadoCentimos).toBe(amplio.porEmpresa.reduce((s: number, e: any) => s + e.ingresoMensualAcordadoCentimos, 0));
    expect(codigo(await plat(operador, 'plataforma_vencimientos_listar', { dias: 91 }))).toBe('argumentos_invalidos');
  });

  it('toda acción nueva queda en la auditoría con el actor', async () => {
    const { rows } = await sistema.query(`select distinct herramienta from core.auditoria_plataforma where actor_usuario_id = $1`, [operador.usuarioId]);
    const h = rows.map((r) => r.herramienta);
    for (const n of ['plataforma_cuenta_pausar', 'plataforma_cuenta_dar_de_baja', 'plataforma_cuenta_reactivar', 'plataforma_modulos_listar', 'plataforma_vencimientos_listar', 'plataforma_empresas_crear']) expect(h).toContain(n);
  });
});
