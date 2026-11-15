import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TipoDeEvento } from '@capaz/shared';
import type pg from 'pg';
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import type { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { crearEmisor, EmitirSinTransaccion } from './emisor.js';
import { esperaDeReintento, MAX_INTENTOS, Relevo } from './relevo.js';
import { RegistroDeConsumidores } from './registro-de-consumidores.js';
import { RegistroDeTareas } from './registro-de-tareas.js';
import type { Consumidor } from './tipos.js';

// Fase 8: el relevo contra PostgreSQL real, con eventos y consumidores declarados aquí mismo.
const emitir = crearEmisor({ 'prueba.hecha': z.object({ n: z.number() }) });
const TIPO = 'prueba.hecha' as TipoDeEvento;

let app: pg.Pool;
let sistema: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let reloj = new Date();
const modulosDe = new Map<string, boolean>(); // empresa → módulo «mprueba» vigente

const acceso = {
  cargarAcceso: async (_rol: string | null, empresaId: string) => ({
    modulos: [{ codigo: 'mprueba', puedeEscribir: modulosDe.get(empresaId) ?? true }],
    permisos: ['mprueba:ver'],
  }),
} as unknown as ServicioDeAcceso;

const crearRelevo = (consumidores: Consumidor[], activo = false, barrido = 1) => {
  const registro = new RegistroDeConsumidores();
  registro.agregar(consumidores);
  const bd = { sistema, aplicacion: app, conEmpresa } as unknown as DatabaseService;
  return new Relevo(bd, acceso, registro, new RegistroDeTareas(), { RELEVO_ACTIVO: activo, RELEVO_BARRIDO_SEGUNDOS: barrido }, pino({ level: 'silent' }), () => reloj);
};

// Cada prueba cuenta solo los eventos de su propia empresa: la base de pruebas es compartida entre pruebas.
const consumidor = (empresa: string, nombre: string, manejar: Consumidor['manejar'], modulo = 'mprueba', evento: Consumidor['evento'] = TIPO): Consumidor => ({
  nombre,
  modulo,
  evento,
  manejar: (ev, ctx, tx) => (ctx.empresaId !== empresa ? Promise.resolve() : manejar(ev, ctx, tx)),
});
const publicar = (e: string, n = 1) => conEmpresa({ empresaId: e, usuarioId: 'u1' }, (tx) => emitir(tx, 'prueba.hecha', { n }));
const fila = (e: string) => comoEmpresa(app, e, async (c) => (await c.query('select * from core.eventos_salida order by id')).rows);
const avanzar = (segundos: number) => (reloj = new Date(reloj.getTime() + segundos * 1000));
async function drenar(r: Relevo) {
  for (let i = 0; i < 20; i++) if ((await r.procesarLote(reloj)).reservados === 0) return;
}

beforeAll(() => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  conEmpresa = conEmpresaDePruebas(app);
});
afterAll(() => Promise.all([app.end(), sistema.end()]));
// Cada prueba parte de un reloj adelantado respecto de la hora real, para que lo emitido ya esté disponible.
const nuevoReloj = () => (reloj = new Date(Date.now() + 60_000));

describe('emitir', () => {
  it('si la transacción se revierte no hay evento', async () => {
    const e = empresaDePrueba();
    await expect(conEmpresa({ empresaId: e, usuarioId: 'u' }, async (tx) => { await emitir(tx, 'prueba.hecha', { n: 1 }); throw new Error('x'); })).rejects.toThrow('x');
    expect(await fila(e)).toHaveLength(0);
  });

  it('falla sin la transacción de conEmpresa y con carga inválida', async () => {
    const e = empresaDePrueba();
    const c = await app.connect();
    try {
      await expect(emitir({} as never, 'prueba.hecha', { n: 1 })).rejects.toBeInstanceOf(EmitirSinTransaccion);
    } finally {
      c.release();
    }
    await expect(conEmpresa({ empresaId: e, usuarioId: 'u' }, (tx) => emitir(tx, 'prueba.hecha', { n: 'x' } as never))).rejects.toThrow('no es válida');
    expect(await fila(e)).toHaveLength(0);
  });

  it('guarda la empresa de la sesión y capaz_sistema no puede leer la carga', async () => {
    const e = empresaDePrueba();
    await publicar(e, 7);
    const [f] = await fila(e);
    expect(f).toMatchObject({ tenant_id: e, tipo: 'prueba.hecha', carga: { n: 7 }, intentos: 0 });
    await expect(sistema.query('select carga from core.eventos_salida limit 1')).rejects.toThrow(/permission denied/);
    await expect(sistema.query('select id, tenant_id, tipo from core.eventos_salida where id = $1', [f.id])).resolves.toBeTruthy();
  });
});

describe('relevo: entrega', () => {
  it('entrega con contexto de sistema dentro de conEmpresa y marca procesado', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    const vistos: unknown[] = [];
    const r = crearRelevo([
      consumidor(e, 'c1', async (ev, ctx, tx) => {
        const s = await tx.execute<{ t: string; u: string }>(sql`select current_setting('app.tenant_id', true) as t, current_setting('app.user_id', true) as u`);
        vistos.push({ carga: ev.carga, canal: ctx.canal, empresa: ctx.empresaId, usuario: ctx.usuarioId, sesion: s.rows[0] });
      }),
    ]);
    await publicar(e, 3);
    await drenar(r);
    expect(vistos).toEqual([{ carga: { n: 3 }, canal: 'sistema', empresa: e, usuario: 'sistema', sesion: { t: e, u: 'sistema' } }]);
    const [f] = await fila(e);
    expect(f.procesado_en).not.toBeNull();
    expect(f.intentos).toBe(1);
  });

  it('el mismo evento entregado dos veces se procesa una vez', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    let veces = 0;
    const r = crearRelevo([consumidor(e, 'c1', async () => void veces++)]);
    await publicar(e);
    await drenar(r);
    await sistema.query('update core.eventos_salida set procesado_en = null where tenant_id = $1', [e]);
    await drenar(r);
    expect(veces).toBe(1);
  });

  it('dos relevos en paralelo no duplican la entrega', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    let veces = 0;
    const consumidores = [consumidor(e, 'c1', async () => { veces++; await new Promise((x) => setTimeout(x, 30)); })];
    await Promise.all([1, 2, 3, 4, 5].map((n) => publicar(e, n)));
    await Promise.all([drenar(crearRelevo(consumidores)), drenar(crearRelevo(consumidores))]);
    expect(veces).toBe(5);
  });

  it('un consumidor que falla se reintenta con espera creciente y no bloquea a los demás', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    let sano = 0;
    let roto = 0;
    const r = crearRelevo([
      consumidor(e, 'roto', async () => { roto++; if (roto < 3) throw new Error('boom'); }),
      consumidor(e, 'sano', async () => void sano++),
    ]);
    await publicar(e);
    await r.procesarLote(reloj);
    let [f] = await fila(e);
    expect(f).toMatchObject({ procesado_en: null, fallido_en: null, intentos: 1 });
    expect(f.ultimo_error).toContain('roto: boom');
    expect(sano).toBe(1);
    await r.procesarLote(reloj); // aún no toca: espera de 30 s
    expect(roto).toBe(1);
    avanzar(esperaDeReintento(1) + 1);
    await r.procesarLote(reloj);
    expect(roto).toBe(2);
    avanzar(esperaDeReintento(2) + 1);
    await r.procesarLote(reloj);
    [f] = await fila(e);
    expect(roto).toBe(3);
    expect(f.procesado_en).not.toBeNull();
    expect(sano).toBe(1); // el sano no se repite
  });

  it(`tras ${MAX_INTENTOS} intentos queda fallido y no se vuelve a reservar`, async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    let llamadas = 0;
    const r = crearRelevo([consumidor(e, 'roto', async () => { llamadas++; throw new Error('siempre'); })]);
    await publicar(e);
    for (let i = 0; i < MAX_INTENTOS + 2; i++) {
      await r.procesarLote(reloj);
      avanzar(3700);
    }
    const [f] = await fila(e);
    expect(f.fallido_en).not.toBeNull();
    expect(f.intentos).toBe(MAX_INTENTOS);
    expect(llamadas).toBe(MAX_INTENTOS);
  });

  it('si el módulo del consumidor no está vigente, se marca procesado sin ejecutar', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    modulosDe.set(e, false);
    let veces = 0;
    const r = crearRelevo([consumidor(e, 'c1', async () => void veces++)]);
    await publicar(e);
    await drenar(r);
    expect(veces).toBe(0);
    expect((await fila(e))[0].procesado_en).not.toBeNull();
    const marcas = await comoEmpresa(app, e, async (c) => (await c.query('select consumidor from core.eventos_procesados')).rows);
    expect(marcas).toEqual([{ consumidor: 'c1' }]);
  });

  it("un consumidor con evento '*' recibe todos", async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    const tipos: string[] = [];
    const r = crearRelevo([consumidor(e, 'todos', async (ev) => void tipos.push(ev.tipo), 'mprueba', '*')]);
    await publicar(e);
    await drenar(r);
    expect(tipos).toEqual(['prueba.hecha']);
  });

  it('un consumidor que escribe y luego falla no deja nada a medias', async () => {
    nuevoReloj();
    const e = empresaDePrueba();
    const r = crearRelevo([
      consumidor(e, 'a-medias', async (ev, _ctx, tx) => {
        await emitir(tx, 'prueba.hecha', { n: 99 });
        throw new Error('después de escribir');
      }),
    ]);
    await publicar(e);
    await r.procesarLote(reloj);
    expect(await fila(e)).toHaveLength(1);
    const marcas = await comoEmpresa(app, e, async (c) => (await c.query('select 1 from core.eventos_procesados')).rows);
    expect(marcas).toHaveLength(0);
  });
});

describe('relevo: señal y ciclo de vida', () => {
  it('despierta por señal al confirmar y se detiene limpio', async () => {
    reloj = new Date(Date.now() + 60_000);
    const e = empresaDePrueba();
    const recibidos: number[] = [];
    const r = crearRelevo([consumidor(e, 'c1', async (ev) => void recibidos.push((ev.carga as { n: number }).n))], true, 3600);
    await r.onApplicationBootstrap();
    await publicar(e, 42);
    for (let i = 0; i < 100 && recibidos.length === 0; i++) await new Promise((x) => setTimeout(x, 50));
    await r.onModuleDestroy();
    expect(recibidos).toEqual([42]);
  });

  it('apagado con RELEVO_ACTIVO falso: no escucha ni procesa solo', async () => {
    reloj = new Date(Date.now() + 60_000);
    const e = empresaDePrueba();
    let veces = 0;
    const r = crearRelevo([consumidor(e, 'c1', async () => void veces++)], false);
    await r.onApplicationBootstrap();
    await publicar(e);
    await new Promise((x) => setTimeout(x, 300));
    await r.onModuleDestroy();
    expect(veces).toBe(0);
  });
});

describe('esperaDeReintento', () => {
  it('crece y tiene tope', () => {
    expect([1, 2, 3].map(esperaDeReintento)).toEqual([30, 60, 120]);
    expect(esperaDeReintento(20)).toBe(3600);
  });
});
