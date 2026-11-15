import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { type NombreDeHerramienta, type Respuesta } from '@capaz/shared';
import { abrirPool, comoEmpresa, conEmpresaDePruebas } from '../../pruebas/base-de-pruebas.js';
import { conectarCatalogo } from '../borradores/catalogo.js';
import { crearHerramientasDeBorradores } from '../borradores/herramientas-de-borradores.js';
import { proponerBorrador } from '../borradores/proponer.js';
import { codigoDe, crearEntorno, TODOS, type Entorno } from './pruebas-del-ejecutor.js';

// Aprobar un borrador cuya herramienta propuesta es CRÍTICA, pasando por el ejecutor real:
// `borrador_aprobar` devuelve el `requiereConfirmacion` de la propuesta y, al reenviar el token,
// la ejecuta y marca el borrador aprobado en la misma transacción.

let pool: pg.Pool;
let e: Entorno;

beforeAll(() => {
  pool = abrirPool('app');
});
afterAll(() => pool.end());

beforeEach(() => {
  e = crearEntorno(pool, (ent) => crearHerramientasDeBorradores(ent.ejecutor));
  conectarCatalogo((n) => (n === 'emitir' ? { modulo: 'core', permiso: 'cotizacion:emitir' } : undefined));
});

const PERMISOS = [...TODOS, 'borradores:ver'];
const llamar = (args: unknown, cambios = {}) => e.llamar('borrador_aprobar', args, { permisos: PERMISOS, ...cambios });
const proponer = (args: Record<string, unknown> = {}) =>
  conEmpresaDePruebas(pool)({ empresaId: e.empresaId, usuarioId: 'agente-1' }, (tx) =>
    proponerBorrador(tx, { herramienta: 'emitir' as NombreDeHerramienta, args, resumen: 'Emitir', origen: 'agente', propuestoPor: 'agente-1' }),
  );
const estadoDe = async (id: string) =>
  (await comoEmpresa(pool, e.empresaId, async (c) => (await c.query('select * from core.borradores where id = $1', [id])).rows))[0];
const pedirToken = async (id: string, cambios = {}): Promise<string> => {
  const r = await llamar({ id }, cambios);
  if (r.ok || !('requiereConfirmacion' in r)) throw new Error(`Debía pedir confirmación: ${JSON.stringify(r)}`);
  return r.requiereConfirmacion.token;
};
const datos = <T>(r: Respuesta<unknown>): T => {
  if (!r.ok || !('datos' in r)) throw new Error(`Se esperaba éxito: ${JSON.stringify(r)}`);
  return r.datos as T;
};

describe('borrador_aprobar con una propuesta crítica', () => {
  it('sin confirmación devuelve requiereConfirmacion y no cambia nada', async () => {
    const { id } = await proponer();
    const r = await llamar({ id });
    expect(r).toMatchObject({ ok: false, requiereConfirmacion: { resumen: '¿Hago emitir?' } });
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual([]);
    expect(await e.marcas()).toEqual([]);
  });

  it('reenviando el token se ejecuta y el borrador queda aprobado en la misma transacción', async () => {
    const { id } = await proponer();
    const token = await pedirToken(id, { usuarioId: 'ana' });
    const r = await llamar({ id, confirmacion: token }, { usuarioId: 'ana' });
    expect(datos<{ borrador: { estado: string; resueltoPor: string }; resultado: unknown }>(r)).toMatchObject({
      borrador: { estado: 'aprobado', resueltoPor: 'ana' },
      resultado: { hecho: true },
    });
    expect((await estadoDe(id)).estado).toBe('aprobado');
    expect(e.estado.ejecuciones).toEqual(['emitir']);
    expect(await e.marcas()).toHaveLength(1); // el token se gastó (core.confirmaciones_usadas)
  });

  it('el token de otra persona se rechaza y nada cambia', async () => {
    const { id } = await proponer();
    const token = await pedirToken(id, { usuarioId: 'ana' });
    expect(codigoDe(await llamar({ id, confirmacion: token }, { usuarioId: 'beto' }))).toBe('confirmacion_no_coincide');
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual([]);
    expect(await e.marcas()).toEqual([]);
  });

  it('un token pedido para otros argumentos se rechaza', async () => {
    const { id } = await proponer({ nota: 'uno' });
    const token = await pedirToken(id);
    // Se corrige el borrador después de pedir la confirmación: los argumentos ya no son los mismos.
    datos(await e.llamar('borrador_corregir', { id, args: { nota: 'dos' } }, { permisos: PERMISOS }));
    expect(codigoDe(await llamar({ id, confirmacion: token }))).toBe('confirmacion_no_coincide');
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('un token ya usado no sirve para otro borrador igual', async () => {
    const a = await proponer();
    const b = await proponer();
    const token = await pedirToken(a.id);
    datos(await llamar({ id: a.id, confirmacion: token }));
    expect(codigoDe(await llamar({ id: b.id, confirmacion: token }))).toBe('confirmacion_ya_usada');
    expect((await estadoDe(b.id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual(['emitir']);
  });

  it('un token inventado se rechaza', async () => {
    const { id } = await proponer();
    expect(codigoDe(await llamar({ id, confirmacion: 'falso.falso' }))).toBe('confirmacion_invalida');
    expect((await estadoDe(id)).estado).toBe('pendiente');
  });

  it('por el canal agente sigue dando confirmacion_solo_ui', async () => {
    const { id } = await proponer();
    expect(codigoDe(await llamar({ id }, { canal: 'agente' }))).toBe('confirmacion_solo_ui');
    expect((await estadoDe(id)).estado).toBe('pendiente');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('una herramienta común no puede pedir confirmación por su cuenta (sigue siendo error_interno)', async () => {
    expect(codigoDe(await e.llamar('pide_sola', {}))).toBe('error_interno');
  });
});
