import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { exito, rechazo } from '@capaz/shared';
import { z } from 'zod';
import { abrirPool } from '../../pruebas/base-de-pruebas.js';
import { crearToken, hashCanonico } from './confirmacion.js';
import { SECRETO, codigoDe, crearEntorno, marcar, type Entorno } from './pruebas-del-ejecutor.js';
import { herramientaDePrueba } from './pruebas.js';

// Confirmación en dos pasos, idempotencia, transacción única y `ejecutarDentro`, contra PostgreSQL real.
// Portado de `ejecutar.test.ts` de Cotizín (bloque «herramienta crítica») y ampliado a la fase 5a.

let pool: pg.Pool;
let e: Entorno;
beforeAll(() => {
  pool = abrirPool('app');
});
afterAll(() => pool.end());

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

let criticaFalla = true;

const nuevo = () => {
  criticaFalla = true;
  e = crearEntorno(pool, ({ estado, empresaId }) => [
    herramientaDePrueba({
      nombre: 'a_medias',
      entrada: z.strictObject({}),
      ejecutar: async (_a, _c, tx) => {
        await marcar(tx, empresaId, 'cambio-a-medias');
        return rechazo('conflicto', 'Falló a medias.');
      },
    }),
    herramientaDePrueba({
      nombre: 'lanza_a_medias',
      ejecutar: async (_a, _c, tx) => {
        await marcar(tx, empresaId, 'cambio-que-lanza');
        throw new Error('boom');
      },
    }),
    herramientaDePrueba({
      nombre: 'critica_falla',
      criticidad: 'critica',
      resumir: async () => ({ ok: true, resumen: { resumen: '¿Va?', huella: 'h' } }),
      ejecutar: async () => (criticaFalla ? rechazo('conflicto', 'No se pudo.') : exito({})),
    }),
    herramientaDePrueba({
      nombre: 'lenta',
      idempotente: true,
      entrada: z.strictObject({ n: z.number() }),
      salida: z.strictObject({ veces: z.number() }),
      ejecutar: async (a, _c, tx) => {
        estado.ejecuciones.push('lenta');
        await dormir(250);
        await marcar(tx, empresaId, `lenta-${a.n}-${estado.ejecuciones.length}`);
        return exito({ veces: estado.ejecuciones.length });
      },
    }),
    herramientaDePrueba({
      nombre: 'hija',
      entrada: z.strictObject({ falla: z.boolean() }),
      ejecutar: async (a, _c, tx) => {
        await marcar(tx, empresaId, 'hija');
        return a.falla ? rechazo('conflicto', 'La hija rechazó.') : exito({});
      },
    }),
    herramientaDePrueba({
      nombre: 'padre',
      entrada: z.strictObject({ hijaFalla: z.boolean(), tragaElRechazo: z.boolean().default(false) }),
      ejecutar: async (a, ctx, tx) => {
        await marcar(tx, empresaId, 'padre');
        const r = await e.ejecutor.ejecutarDentro(tx, 'hija', { falla: a.hijaFalla }, { ctx });
        return a.hijaFalla && !a.tragaElRechazo ? (r as ReturnType<typeof rechazo>) : exito({});
      },
    }),
  ]);
};

const pedirToken = async (nombre = 'emitir', args: Record<string, unknown> = {}, cambios = {}) => {
  const r = await e.llamar(nombre, args, cambios);
  if (r.ok || !('requiereConfirmacion' in r)) throw new Error('Debía pedir confirmación');
  return r.requiereConfirmacion;
};
const confirmar = (token: string, args: Record<string, unknown> = {}, cambios = {}, nombre = 'emitir') =>
  e.ejecutor.ejecutar(nombre, args, { ctx: e.ctx(cambios), confirmacion: token });

describe('herramienta crítica: confirmación en dos pasos', () => {
  it('sin token pide confirmación (resumen, token, vence a 2 minutos) y no ejecuta; la auditoría lo anota', async () => {
    nuevo();
    expect(await e.llamar('emitir', {})).toMatchObject({ ok: false, requiereConfirmacion: { resumen: '¿Hago emitir?', venceEn: '2026-09-19T12:02:00.000Z' } });
    expect(e.estado.ejecuciones).toEqual([]);
    expect((await e.auditoria())[0]).toMatchObject({ resultado: 'pendiente_confirmacion', codigo: null });
  });

  it('con el token ejecuta; el jti queda registrado como usado y la auditoría guarda ok', async () => {
    nuevo();
    const { token } = await pedirToken();
    expect(await confirmar(token)).toMatchObject({ ok: true, datos: { hecho: true } });
    expect(e.estado.ejecuciones).toEqual(['emitir']);
    expect(await e.marcas()).toEqual([`jti-${e.empresaId}-1`]);
    expect((await e.auditoria()).map((f) => f.resultado)).toEqual(['pendiente_confirmacion', 'ok']);
  });

  it('el token y los argumentos nunca quedan en la auditoría', async () => {
    nuevo();
    const { token } = await pedirToken('emitir', { motivo: 'cliente antiguo' });
    await confirmar(token, { motivo: 'cliente antiguo' });
    for (const f of await e.auditoria()) {
      expect(JSON.stringify(f)).not.toContain(token);
      expect(JSON.stringify(f)).not.toContain('cliente antiguo');
    }
  });

  it('un token no se puede reutilizar', async () => {
    nuevo();
    const { token } = await pedirToken();
    await confirmar(token);
    expect(codigoDe(await confirmar(token))).toBe('confirmacion_ya_usada');
    expect(e.estado.ejecuciones).toEqual(['emitir']);
  });

  it('el mismo token usado dos veces a la vez solo vale una', async () => {
    nuevo();
    const { token } = await pedirToken();
    const rs = await Promise.all([confirmar(token), confirmar(token)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.map(codigoDe).filter(Boolean)).toEqual(['confirmacion_ya_usada']);
    expect(e.estado.ejecuciones).toEqual(['emitir']);
  });

  it('un token vencido se rechaza (a los 2 minutos exactos ya no vale)', async () => {
    nuevo();
    const { token } = await pedirToken();
    e.reloj.ahora = new Date('2026-09-19T12:01:59.000Z');
    expect((await confirmar(token)).ok).toBe(true);
    const { token: segundo } = await pedirToken();
    e.reloj.ahora = new Date('2026-09-19T12:04:00.000Z');
    expect(codigoDe(await confirmar(segundo))).toBe('confirmacion_vencida');
  });

  it('un token pedido con otros argumentos no vale para estos', async () => {
    nuevo();
    const { token } = await pedirToken('emitir', { motivo: 'uno' });
    expect(codigoDe(await confirmar(token, { motivo: 'otro' }))).toBe('confirmacion_no_coincide');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('un token de otra herramienta no vale', async () => {
    nuevo();
    const { token } = await pedirToken('emitir');
    expect(codigoDe(await confirmar(token, {}, {}, 'anular'))).toBe('confirmacion_no_coincide');
  });

  it('un token de otra persona o de otra empresa no vale, y no se consume', async () => {
    nuevo();
    const { token } = await pedirToken('emitir');
    expect(codigoDe(await confirmar(token, {}, { usuarioId: 'u2' }))).toBe('confirmacion_no_coincide');
    expect(codigoDe(await confirmar(token, {}, { empresaId: 'otra-empresa' }))).toBe('confirmacion_no_coincide');
    expect((await confirmar(token)).ok).toBe(true);
  });

  it('solo la interfaz puede pedir y confirmar una crítica; el intento del agente no consume el token', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('emitir', {}, { canal: 'agente' }))).toBe('confirmacion_solo_ui');
    const { token } = await pedirToken();
    for (const canal of ['agente', 'mcp', 'sistema'] as const) {
      expect(codigoDe(await confirmar(token, {}, { canal }))).toBe('confirmacion_solo_ui');
    }
    expect((await confirmar(token)).ok).toBe(true);
    expect(e.estado.ejecuciones).toEqual(['emitir']);
  });

  it('si el estado cambió después de pedir la confirmación, no vale (la huella no coincide)', async () => {
    nuevo();
    const { token } = await pedirToken();
    e.estado.version = 2;
    expect(codigoDe(await confirmar(token))).toBe('confirmacion_desactualizada');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('un token alterado, inventado o firmado con otro secreto se rechaza', async () => {
    nuevo();
    const { token } = await pedirToken();
    expect(codigoDe(await confirmar(`${token.slice(0, -2)}xx`))).toBe('confirmacion_invalida');
    expect(codigoDe(await confirmar('inventado'))).toBe('confirmacion_invalida');
    const ajeno = crearToken(
      { herramienta: 'emitir', hashArgs: hashCanonico({}), huella: 'v1', usuarioId: 'u1', empresaId: e.empresaId, jti: 'x', exp: 9_999_999_999 },
      'otro-secreto-distinto-de-al-menos-32-caracteres',
    );
    expect(codigoDe(await confirmar(ajeno))).toBe('confirmacion_invalida');
    expect(e.estado.ejecuciones).toEqual([]);
  });

  it('un token bien firmado por el sistema para estos mismos datos vale (control de la prueba anterior)', async () => {
    nuevo();
    const bueno = crearToken(
      { herramienta: 'emitir', hashArgs: hashCanonico({}), huella: 'v1', usuarioId: 'u1', empresaId: e.empresaId, jti: 'manual', exp: 9_999_999_999 },
      SECRETO,
    );
    expect((await confirmar(bueno)).ok).toBe(true);
  });

  it('si las condiciones previas fallan no se emite token', async () => {
    nuevo();
    const r = await e.llamar('emitir', { motivo: 'impedido' });
    expect(codigoDe(r)).toBe('conflicto');
    expect((await e.auditoria())[0]).toMatchObject({ resultado: 'rechazada', codigo: 'conflicto' });
  });

  it('en una herramienta que no es crítica, «confirmacion» es un argumento que no existe', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('editar', { valor: 'x', confirmacion: 'algo' }))).toBe('argumentos_invalidos');
  });

  it('el orden de las llaves de los argumentos no invalida el token', async () => {
    nuevo();
    const { token } = await pedirToken('emitir', { motivo: 'm', nota: 'n' });
    expect((await confirmar(token, { nota: 'n', motivo: 'm' })).ok).toBe(true);
  });
});

describe('una transacción por llamada', () => {
  it('una herramienta que rechaza a medias no deja cambios y sí la auditoría del rechazo', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('a_medias', {}))).toBe('conflicto');
    expect(await e.marcas()).toEqual([]);
    expect(await e.auditoria()).toMatchObject([{ herramienta: 'a_medias', resultado: 'rechazada', codigo: 'conflicto' }]);
  });

  it('una herramienta que lanza a medias tampoco deja cambios, y queda auditado como error interno', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('lanza_a_medias', {}))).toBe('error_interno');
    expect(await e.marcas()).toEqual([]);
    expect(await e.auditoria()).toMatchObject([{ resultado: 'rechazada', codigo: 'error_interno' }]);
  });

  it('un rechazo tras reservar la confirmación la devuelve: se puede volver a intentar con el mismo token', async () => {
    nuevo();
    const { token } = await pedirToken('critica_falla');
    expect(codigoDe(await confirmar(token, {}, {}, 'critica_falla'))).toBe('conflicto');
    expect(await e.marcas()).toEqual([]);
    criticaFalla = false;
    expect((await confirmar(token, {}, {}, 'critica_falla')).ok).toBe(true);
    expect(await e.marcas()).toHaveLength(1);
  });
});

describe('idempotencia', () => {
  const llamarCon = (clave: string | undefined, n = 1) =>
    e.ejecutor.ejecutar('lenta', { n }, { ctx: e.ctx(), claveDeIdempotencia: clave });

  it('la repetición con la misma clave y los mismos argumentos devuelve la respuesta guardada sin ejecutar', async () => {
    nuevo();
    const primera = await llamarCon('clave-1');
    const segunda = await llamarCon('clave-1');
    expect(segunda).toEqual(primera);
    expect(e.estado.ejecuciones).toEqual(['lenta']);
    expect((await e.auditoria()).filter((f) => f.herramienta === 'lenta')).toHaveLength(1);
  });

  it('la misma clave con otros argumentos o con otra herramienta es un conflicto', async () => {
    nuevo();
    await llamarCon('clave-2', 1);
    expect(codigoDe(await llamarCon('clave-2', 2))).toBe('conflicto');
    expect(e.estado.ejecuciones).toEqual(['lenta']);
  });

  it('sin clave, o en una herramienta no idempotente, cada llamada ejecuta', async () => {
    nuevo();
    await llamarCon(undefined);
    await llamarCon(undefined);
    expect(e.estado.ejecuciones).toEqual(['lenta', 'lenta']);
    await e.ejecutor.ejecutar('editar', { valor: 'a' }, { ctx: e.ctx(), claveDeIdempotencia: 'k' });
    await e.ejecutor.ejecutar('editar', { valor: 'a' }, { ctx: e.ctx(), claveDeIdempotencia: 'k' });
    expect(e.estado.ejecuciones.filter((x) => x === 'editar')).toHaveLength(2);
  });

  it('dos peticiones simultáneas con la misma clave: la segunda espera y recibe la respuesta de la primera', async () => {
    nuevo();
    const [a, b] = await Promise.all([llamarCon('clave-3'), llamarCon('clave-3')]);
    expect(a).toEqual(b);
    expect(a.ok).toBe(true);
    expect(e.estado.ejecuciones).toEqual(['lenta']);
  });

  it('dos peticiones simultáneas con la misma clave y otros argumentos: una gana y la otra es conflicto', async () => {
    nuevo();
    const rs = await Promise.all([llamarCon('clave-4', 1), llamarCon('clave-4', 2)]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
    expect(rs.map(codigoDe).filter(Boolean)).toEqual(['conflicto']);
  });

  it('otra persona con la misma clave no recibe la respuesta de la primera', async () => {
    nuevo();
    await llamarCon('clave-5');
    await e.ejecutor.ejecutar('lenta', { n: 1 }, { ctx: e.ctx({ usuarioId: 'u2' }), claveDeIdempotencia: 'clave-5' });
    expect(e.estado.ejecuciones).toEqual(['lenta', 'lenta']);
  });

  it('si la herramienta rechaza, la clave no queda ocupada: se puede reintentar', async () => {
    nuevo();
    const rechazada = await e.ejecutor.ejecutar('a_medias', {}, { ctx: e.ctx(), claveDeIdempotencia: 'clave-6' });
    expect(codigoDe(rechazada)).toBe('conflicto');
    expect(codigoDe(await e.ejecutor.ejecutar('a_medias', {}, { ctx: e.ctx(), claveDeIdempotencia: 'clave-6' }))).toBe('conflicto');
  });
});

describe('ejecutarDentro: una herramienta que ejecuta otra', () => {
  it('éxito: lo del padre y lo de la hija se confirman juntos, con las dos auditorías', async () => {
    nuevo();
    expect((await e.llamar('padre', { hijaFalla: false })).ok).toBe(true);
    expect(await e.marcas()).toEqual(['hija', 'padre']);
    expect((await e.auditoria()).map((f) => `${f.herramienta}:${f.resultado}`).sort()).toEqual(['hija:ok', 'padre:ok']);
  });

  it('rechazo: el padre responde el mismo rechazo y se revierte todo junto, con la auditoría del padre', async () => {
    nuevo();
    expect(codigoDe(await e.llamar('padre', { hijaFalla: true }))).toBe('conflicto');
    expect(await e.marcas()).toEqual([]);
    expect(await e.auditoria()).toMatchObject([{ herramienta: 'padre', resultado: 'rechazada', codigo: 'conflicto' }]);
  });

  it('si el padre sigue adelante, solo se deshace lo de la hija y su rechazo queda auditado', async () => {
    nuevo();
    expect((await e.llamar('padre', { hijaFalla: true, tragaElRechazo: true })).ok).toBe(true);
    expect(await e.marcas()).toEqual(['padre']);
    expect((await e.auditoria()).map((f) => `${f.herramienta}:${f.resultado}`).sort()).toEqual(['hija:rechazada', 'padre:ok']);
  });

  it('aplica las mismas comprobaciones: sin permiso o con argumentos de contexto no ejecuta', async () => {
    nuevo();
    const dentro = herramientaDePrueba({
      nombre: 'directa',
      ejecutar: async (_a, ctx, tx) => {
        const a = await e.ejecutor.ejecutarDentro(tx, 'editar', { valor: 'x' }, { ctx: { ...ctx, permisos: [] } });
        const b = await e.ejecutor.ejecutarDentro(tx, 'eco', { texto: 'x', tenantId: 'z' }, { ctx });
        return exito({ a: codigoDe(a), b: codigoDe(b) });
      },
    });
    (e.ejecutor as unknown as { registro: { agregar: (h: unknown[]) => void } }).registro.agregar([dentro]);
    expect(await e.llamar('directa', {})).toMatchObject({ ok: true, datos: { a: 'sin_permiso', b: 'argumento_prohibido' } });
    expect(e.estado.ejecuciones).toEqual([]);
  });
});
