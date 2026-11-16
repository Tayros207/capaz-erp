import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { z } from 'zod';
import { exito, rechazo, type NombreDeHerramienta, type Respuesta } from '@capaz/shared';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { acceso, codigoDe, crearEntorno, marcar, TODOS, type Entorno } from '../herramientas/pruebas-del-ejecutor.js';
import { herramientaDePrueba } from '../herramientas/pruebas.js';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { conectarCatalogo } from './catalogo.js';
import { crearHerramientasDeBorradores } from './herramientas-de-borradores.js';
import { proponerBorrador, type PropuestaDeBorrador } from './proponer.js';

// Fase 13 (servidor): la bandeja de borradores contra PostgreSQL real. Las herramientas propuestas son
// de prueba (`editar`, `emitir`…): aquí no hay negocio.

let pool: pg.Pool;
let e: Entorno;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let borradoras: HerramientaRegistrada[];

beforeAll(() => {
  pool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(pool);
});
afterAll(() => pool.end());

const CATALOGO: Record<string, { modulo: string; permiso: string | null }> = {
  editar: { modulo: 'core', permiso: 'cotizacion:editar' },
  emitir: { modulo: 'core', permiso: 'cotizacion:emitir' },
  de_registro: { modulo: 'registro', permiso: 'cotizacion:editar' },
  falla: { modulo: 'core', permiso: null },
};

beforeEach(() => {
  e = crearEntorno(pool, (ent) => {
    borradoras = crearHerramientasDeBorradores(ent.ejecutor);
    return [
      ...borradoras,
      herramientaDePrueba({
        nombre: 'de_registro',
        modulo: 'registro',
        permiso: 'cotizacion:editar',
        entrada: z.strictObject({ valor: z.string() }),
        salida: z.strictObject({ valor: z.string() }),
        ejecutar: async (a) => exito({ valor: a.valor }),
      }),
      herramientaDePrueba({
        nombre: 'falla',
        entrada: z.strictObject({ valor: z.string() }),
        ejecutar: async (_a, _c, tx) => {
          await marcar(tx, ent.empresaId, 'cambio-de-falla');
          return rechazo('conflicto', 'Eso no se puede.');
        },
      }),
    ];
  });
  conectarCatalogo((n) => CATALOGO[n]);
});

const proponer = (extra: Partial<PropuestaDeBorrador> = {}, empresa = e.empresaId) =>
  conEmpresaDePruebas(pool)({ empresaId: empresa, usuarioId: 'agente-1' }, (tx) =>
    proponerBorrador(tx, {
      herramienta: 'editar' as NombreDeHerramienta,
      args: { valor: 'a' },
      resumen: 'Editar a',
      origen: 'agente',
      propuestoPor: 'agente-1',
      ...extra,
    }),
  );

const PERMISOS = [...TODOS, 'borradores:ver'];
const llamar = (nombre: string, args: unknown, cambios = {}) => e.llamar(nombre, args, { permisos: PERMISOS, ...cambios });
const datos = <T>(r: Respuesta<unknown>): T => {
  if (!r.ok || !('datos' in r)) throw new Error(`Se esperaba éxito: ${JSON.stringify(r)}`);
  return r.datos as T;
};
const estadoDe = async (id: string) =>
  (await comoEmpresa(pool, e.empresaId, async (c) => (await c.query('select * from core.borradores where id = $1', [id])).rows))[0];

describe('proponerBorrador', () => {
  it('guarda args y args_originales iguales, módulo de la herramienta y estado pendiente', async () => {
    const { id } = await proponer({ args: { valor: 'sin validar', de_mas: 1 }, prioridad: 'alta', origenRef: 'dictado-7' });
    const f = await estadoDe(id);
    expect(f).toMatchObject({ estado: 'pendiente', modulo: 'core', prioridad: 'alta', origen_ref: 'dictado-7', corregido: false, tenant_id: e.empresaId });
    expect(f.args).toEqual(f.args_originales);
    expect(f.args).toEqual({ valor: 'sin validar', de_mas: 1 });
  });

  it('rechaza una herramienta que no existe y no deja nada', async () => {
    await expect(proponer({ herramienta: 'no_existe' as NombreDeHerramienta })).rejects.toThrow(/no existe/);
  });

  it('emite borrador.propuesto en la misma transacción', async () => {
    const { id } = await proponer();
    const filas = await comoEmpresa(pool, e.empresaId, async (c) => (await c.query(`select carga from core.eventos_salida where tipo = 'borrador.propuesto'`)).rows);
    expect(filas.map((f) => f.carga.id)).toContain(id);
  });
});

describe('borrador_aprobar', () => {
  it('ejecuta la propuesta con quien aprueba y marca aprobado; audita quién aprobó', async () => {
    const { id } = await proponer();
    const r = await llamar('borrador_aprobar', { id }, { usuarioId: 'ana' });
    const d = datos<{ borrador: { estado: string; resueltoPor: string }; resultado: unknown }>(r);
    expect(d.borrador).toMatchObject({ estado: 'aprobado', resueltoPor: 'ana' });
    expect(d.resultado).toEqual({ valor: 'a' });
    expect(e.estado.ejecuciones).toEqual(['editar']);
    const aud = await e.auditoria();
    expect(aud.find((a) => a.herramienta === 'editar')).toMatchObject({ usuario_id: 'ana', resultado: 'ok' });
    expect(aud.find((a) => a.herramienta === 'borrador_aprobar')).toMatchObject({ usuario_id: 'ana', entidad_id: id });
  });

  it('ejecuta una sola vez aunque se pulse dos veces a la vez', async () => {
    const { id } = await proponer();
    const [a, b] = await Promise.all([llamar('borrador_aprobar', { id }), llamar('borrador_aprobar', { id })]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(codigoDe(a.ok ? b : a)).toBe('conflicto');
    expect(e.estado.ejecuciones).toEqual(['editar']);
    expect(await llamar('borrador_aprobar', { id }).then(codigoDe)).toBe('conflicto');
    expect(e.estado.ejecuciones).toEqual(['editar']);
  });

  it('sin el permiso de la herramienta propuesta responde sin_permiso y el borrador sigue pendiente', async () => {
    const { id } = await proponer();
    const r = await llamar('borrador_aprobar', { id }, { permisos: ['borradores:ver'] });
    expect(codigoDe(r)).toBe('sin_permiso');
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('por el canal agente no se aprueba', async () => {
    const { id } = await proponer();
    expect(codigoDe(await llamar('borrador_aprobar', { id }, { canal: 'agente' }))).toBe('confirmacion_solo_ui');
    expect((await estadoDe(id)).estado).toBe('pendiente');
  });

  it('si la herramienta rechaza, responde ese rechazo, nada cambia y queda en la auditoría', async () => {
    const { id } = await proponer({ herramienta: 'falla' as NombreDeHerramienta, args: { valor: 'x' } });
    const r = await llamar('borrador_aprobar', { id });
    expect(r).toMatchObject({ ok: false, error: { codigo: 'conflicto', mensaje: 'Eso no se puede.' } });
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(await e.marcas()).not.toContain('cambio-de-falla');
    const aud = await e.auditoria();
    expect(aud.find((a) => a.herramienta === 'borrador_aprobar')).toMatchObject({ resultado: 'rechazada', codigo: 'conflicto' });
  });

  it('los argumentos inválidos se detectan al aprobar y el borrador sigue pendiente', async () => {
    const { id } = await proponer({ args: { falta: true } });
    expect(codigoDe(await llamar('borrador_aprobar', { id }))).toBe('argumentos_invalidos');
    expect((await estadoDe(id)).estado).toBe('pendiente');
  });

  it('un borrador descartado no se aprueba', async () => {
    const { id } = await proponer();
    datos(await llamar('borrador_descartar', { id, motivo: 'Duplicado' }));
    expect(codigoDe(await llamar('borrador_aprobar', { id }))).toBe('conflicto');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('con una propuesta crítica, la herramienta reenvía la confirmación a la propuesta', async () => {
    const { id } = await proponer({ herramienta: 'emitir' as NombreDeHerramienta, args: {} });
    const aprobar = borradoras.find((h) => h.nombre === 'borrador_aprobar')!;
    const correr = (args: unknown) => conEmpresa({ empresaId: e.empresaId, usuarioId: 'u1' }, (tx) => aprobar.ejecutar(args, e.ctx({ permisos: PERMISOS }), tx));
    const primera = await correr({ id });
    if (primera.ok || !('requiereConfirmacion' in primera)) throw new Error('Debía pedir confirmación.');
    expect((await estadoDe(id)).estado).toBe('pendiente');
    const segunda = await correr({ id, confirmacion: primera.requiereConfirmacion.token });
    expect(datos<{ borrador: { estado: string } }>(segunda).borrador.estado).toBe('aprobado');
    expect(e.estado.ejecuciones).toEqual(['emitir']);
  });
});

describe('borrador_corregir y borrador_descartar', () => {
  it('corregir conserva args_originales y marca corregido; aprobar ejecuta lo corregido', async () => {
    const { id } = await proponer({ args: { valor: 'malo' } });
    const r = await llamar('borrador_corregir', { id, args: { valor: 'bueno' } });
    expect(datos<{ corregido: boolean; args: unknown; argsOriginales: unknown }>(r)).toMatchObject({ corregido: true, args: { valor: 'bueno' }, argsOriginales: { valor: 'malo' } });
    expect(datos<{ resultado: unknown }>(await llamar('borrador_aprobar', { id })).resultado).toEqual({ valor: 'bueno' });
  });

  it('corregir y descartar exigen el permiso de la herramienta propuesta', async () => {
    const { id } = await proponer();
    const solo = { permisos: ['borradores:ver'] };
    expect(codigoDe(await llamar('borrador_corregir', { id, args: { valor: 'z' } }, solo))).toBe('sin_permiso');
    expect(codigoDe(await llamar('borrador_descartar', { id, motivo: 'x' }, solo))).toBe('sin_permiso');
    expect((await estadoDe(id)).estado).toBe('pendiente');
  });

  it('descartar guarda motivo, quién y cuándo, y exige motivo', async () => {
    const { id } = await proponer();
    expect(codigoDe(await llamar('borrador_descartar', { id, motivo: '  ' }))).toBe('argumentos_invalidos');
    datos(await llamar('borrador_descartar', { id, motivo: 'Ya existe' }, { usuarioId: 'ana' }));
    expect(await estadoDe(id)).toMatchObject({ estado: 'descartado', motivo_descarte: 'Ya existe', resuelto_por: 'ana' });
  });
});

describe('lectura y aislamiento', () => {
  it('otra empresa no ve el borrador ni puede resolverlo', async () => {
    const { id } = await proponer();
    const otra = empresaDePrueba();
    const ctx = { empresaId: otra, modulos: [acceso('core'), acceso('registro')], permisos: PERMISOS };
    const desde = (n: string, a: unknown) => e.ejecutor.ejecutar(n, a, { ctx: e.ctx(ctx) });
    expect(codigoDe(await desde('borrador_ver', { id }))).toBe('no_encontrado');
    expect(codigoDe(await desde('borrador_aprobar', { id }))).toBe('no_encontrado');
    expect(datos<{ items: unknown[] }>(await desde('borradores_listar', {})).items).toEqual([]);
    expect((await estadoDe(id)).estado).toBe('pendiente');
  });

  it('un member ve solo los de los módulos a los que puede entrar', async () => {
    const del_core = await proponer();
    const del_registro = await proponer({ herramienta: 'de_registro' as NombreDeHerramienta, args: { valor: 'r' } });
    const ids = (r: Respuesta<unknown>) => datos<{ items: { id: string }[] }>(r).items.map((i) => i.id);
    expect(ids(await llamar('borradores_listar', {}))).toEqual(expect.arrayContaining([del_core.id, del_registro.id]));
    const sinRegistro = { modulos: [acceso('core')] };
    const vistos = ids(await llamar('borradores_listar', {}, sinRegistro));
    expect(vistos).toContain(del_core.id);
    expect(vistos).not.toContain(del_registro.id);
    expect(codigoDe(await llamar('borrador_ver', { id: del_registro.id }, sinRegistro))).toBe('no_encontrado');
    expect(codigoDe(await llamar('borrador_aprobar', { id: del_registro.id }, sinRegistro))).toBe('no_encontrado');
  });

  it('filtra por estado y origen y pagina con cursor', async () => {
    const a = await proponer({ origen: 'voz' });
    await proponer({ origen: 'regla' });
    await proponer({ origen: 'regla' });
    datos(await llamar('borrador_descartar', { id: a.id, motivo: 'x' }));
    const reglas = datos<{ items: unknown[] }>(await llamar('borradores_listar', { origen: 'regla', estado: 'pendiente' }));
    expect(reglas.items).toHaveLength(2);
    const p1 = datos<{ items: { id: string }[]; siguiente: string | null }>(await llamar('borradores_listar', { limite: 1, origen: 'regla' }));
    expect(p1.items).toHaveLength(1);
    expect(p1.siguiente).not.toBeNull();
    const p2 = datos<{ items: { id: string }[] }>(await llamar('borradores_listar', { limite: 5, origen: 'regla', cursor: p1.siguiente! }));
    expect(p2.items).toHaveLength(1);
    expect(p2.items[0]!.id).not.toBe(p1.items[0]!.id);
    expect(codigoDe(await llamar('borradores_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});

describe('borradores_resumen', () => {
  it('cuenta pendientes y de alta prioridad, solo de módulos a los que se puede entrar', async () => {
    const resumen = async (cambios = {}) => datos<{ pendientes: number; deAltaPrioridad: number }>(await llamar('borradores_resumen', {}, cambios));
    expect(await resumen()).toEqual({ pendientes: 0, deAltaPrioridad: 0 });
    await proponer({ prioridad: 'alta' });
    await proponer();
    await proponer({ herramienta: 'de_registro' as NombreDeHerramienta, args: { valor: 'r' } });
    const resuelto = await proponer();
    datos(await llamar('borrador_descartar', { id: resuelto.id, motivo: 'x' }));
    expect(await resumen()).toEqual({ pendientes: 3, deAltaPrioridad: 1 });
    expect(await resumen({ modulos: [acceso('core')] })).toEqual({ pendientes: 2, deAltaPrioridad: 1 });
  });

  it('no cuenta los de otra empresa y pide borradores:ver', async () => {
    await proponer();
    const otra = empresaDePrueba();
    const ctx = { empresaId: otra, modulos: [acceso('core'), acceso('registro')], permisos: PERMISOS };
    const r = await e.ejecutor.ejecutar('borradores_resumen', {}, { ctx: e.ctx(ctx) });
    expect(datos(r)).toEqual({ pendientes: 0, deAltaPrioridad: 0 });
    expect(codigoDe(await llamar('borradores_resumen', {}, { permisos: [] }))).toBe('sin_permiso');
  });
});

describe('herramientas con secretos', () => {
  it('no se pueden proponer como borrador', async () => {
    const { HERRAMIENTAS_CON_SECRETOS } = await import('./proponer.js');
    expect(HERRAMIENTAS_CON_SECRETOS).toEqual(
      expect.arrayContaining(['conexion_configurar', 'clave_api_crear', 'webhooks_salientes_crear', 'webhooks_salientes_editar']),
    );
  });
});
