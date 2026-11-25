import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { abrirPool, conEmpresaDePruebas } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { LIMITE_DE_CAPTURAS_POR_MINUTO, ServicioDeTranscripcion } from './servicio-de-transcripcion.js';
import { TRANSCRIPTOR_DE_VOZ, TranscriptorSimulado } from './transcriptor-de-voz.js';
import { wavEnBase64 } from './wav-de-pruebas.js';

// El dictado por audio contra el servidor real y PostgreSQL real, con un transcriptor FALSO (nunca se llama al modelo de verdad).

const RUTA = '/api/v1/agente/transcribir';
const UN_SEGUNDO = wavEnBase64({ muestras: 16_000 });

let app: AppDePruebas;
let appPool: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let transcriptor: TranscriptorSimulado;

beforeAll(async () => {
  process.env.AGENTE_PROVEEDOR = 'simulado';
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  conEmpresa = conEmpresaDePruebas(appPool);
  transcriptor = app.obtener<TranscriptorSimulado>(TRANSCRIPTOR_DE_VOZ);
});
afterAll(async () => {
  delete process.env.AGENTE_PROVEEDOR;
  await app.cerrar();
  await appPool.end();
});
beforeEach(() => transcriptor.programar([]));

type Persona = { sesion: Sesion; empresa: string };
async function personaNueva(nombre: string): Promise<Persona> {
  const sesion = await abrirSesion(app, nombre);
  return { sesion, empresa: await crearEmpresa(sesion, nombre) };
}
const transcribir = (p: Persona, audioBase64 = UN_SEGUNDO, cabeceras?: Record<string, string>) => p.sesion.pedir('POST', RUTA, { audioBase64, formato: 'wav' }, cabeceras);
const usoDe = (p: Persona) =>
  conEmpresa({ empresaId: p.empresa, usuarioId: p.sesion.usuarioId }, async (tx) =>
    (await tx.execute(sql`select turno_id, modelo, costo_microusd::int as costo, rondas, tokens_entrada, resultado from core.uso where origen = 'captura' order by creado_en, rondas`)).rows as Record<string, unknown>[],
  );

describe('POST /agente/transcribir · puerta', () => {
  it('sin sesión responde 401', async () => {
    const anonimo = await abrirSesion(app);
    await anonimo.pedir('POST', '/api/auth/sign-out', {});
    expect((await anonimo.pedir('POST', RUTA, { audioBase64: UN_SEGUNDO, formato: 'wav' })).estado).toBe(401);
  });

  it('sin empresa activa responde sin_empresa', async () => {
    const r = await (await abrirSesion(app)).pedir('POST', RUTA, { audioBase64: UN_SEGUNDO, formato: 'wav' });
    expect(r.estado).toBe(403);
    expect(r.cuerpo.error.codigo).toBe('sin_empresa');
  });

  it('desde otro sitio no pasa y no llama al transcriptor', async () => {
    const p = await personaNueva('Voz · origen');
    const r = await transcribir(p, UN_SEGUNDO, { origin: 'https://sitio-malo.example' });
    expect(r.cuerpo.error.codigo).toBe('origen_invalido');
    expect(transcriptor.recibidos).toBe(0);
  });
});

describe('POST /agente/transcribir · el audio', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await personaNueva('Voz · audio');
  });

  it('un WAV mal formado, lo que no es base64 u otro formato responden 400 sin llamar a nadie', async () => {
    const antes = transcriptor.recibidos;
    for (const cuerpo of [
      { audioBase64: Buffer.from('esto no es un wav, aunque venga en base64').toString('base64'), formato: 'wav' },
      { audioBase64: wavEnBase64({ bits: 8 }), formato: 'wav' },
      { audioBase64: 'no es base64 !!', formato: 'wav' },
      { audioBase64: UN_SEGUNDO, formato: 'mp3' },
    ]) {
      const r = await P.sesion.pedir('POST', RUTA, cuerpo);
      expect(r.estado, JSON.stringify(r.cuerpo)).toBe(400);
      expect(r.cuerpo.error.codigo).toBe('argumentos_invalidos');
      expect(JSON.stringify(r.cuerpo)).not.toContain(UN_SEGUNDO.slice(0, 40));
    }
    expect(transcriptor.recibidos).toBe(antes);
  });

  it('más de 60 s se rechaza (el cuerpo grande sí entra en esta ruta) y nada queda en core.uso', async () => {
    const r = await transcribir(P, wavEnBase64({ muestras: 16_000 * 61 }));
    expect(r.estado).toBe(413);
    expect(r.cuerpo.error).toEqual({ codigo: 'solicitud_muy_grande', mensaje: 'El audio dura más de 60 segundos. Dicta en partes más cortas.' });
    expect(await usoDe(P)).toEqual([]);
  });

  it('el límite grande es solo de esta ruta: otra ruta con 300 kB sigue rechazándose', async () => {
    const r = await P.sesion.pedir('POST', '/api/v1/agente/conversaciones/x/renombrar', { titulo: 'x'.repeat(300_000) });
    expect(r.estado).toBe(413);
  });

  it('un toque sin querer (menos de 0,3 s) devuelve vacío sin llamar a nadie', async () => {
    const antes = transcriptor.recibidos;
    const r = await transcribir(P, wavEnBase64({ muestras: 1_600 }));
    expect(r.cuerpo).toEqual({ ok: true, datos: { texto: '' }, avisos: [] });
    expect(transcriptor.recibidos).toBe(antes);
  });
});

describe('POST /agente/transcribir · éxito y costo', () => {
  let P: Persona;
  beforeAll(async () => {
    P = await personaNueva('Voz · éxito');
  });

  it('devuelve el texto y deja la reserva y el costo con el mismo turno en core.uso', async () => {
    transcriptor.programar([{ ok: true, texto: 'Ingreso 500 soles cliente Juan Pérez flyers', uso: { tokensEntrada: 410, tokensSalida: 12, costoMicrousd: 183 } }]);
    const r = await transcribir(P);
    expect(r.estado).toBe(200);
    expect(r.cabeceras.get('cache-control')).toBe('no-store');
    expect(r.cuerpo.datos).toEqual({ texto: 'Ingreso 500 soles cliente Juan Pérez flyers' });
    const filas = await usoDe(P);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toMatchObject({ modelo: 'simulado/voz', costo: 0, rondas: 0, resultado: 'ok' });
    expect(filas[1]).toMatchObject({ modelo: 'simulado/voz', costo: 183, rondas: 1, tokens_entrada: 410, resultado: 'ok' });
    expect(filas[0]!.turno_id).toBe(filas[1]!.turno_id);
  });

  it('el texto se recorta al máximo del dictado', async () => {
    transcriptor.programar([{ ok: true, texto: 'palabra '.repeat(100), uso: null }]);
    expect((await transcribir(P)).cuerpo.datos.texto).toHaveLength(500);
  });

  it('un fallo del modelo se dice en español y su intento queda anotado como error', async () => {
    transcriptor.programar([{ ok: false, motivo: 'modelo_no_disponible', uso: null, estado: 503 }]);
    const r = await transcribir(P);
    expect(r.estado).toBe(503);
    expect(r.cuerpo.error.codigo).toBe('modelo_no_disponible');
    expect(r.cuerpo.error.mensaje).toMatch(/no está disponible/);
    expect((await usoDe(P)).at(-1)).toMatchObject({ costo: 0, rondas: 1, resultado: 'error' });
  });
});

describe('POST /agente/transcribir · límites', () => {
  it('con el tope del mes alcanzado se rechaza antes de llamar al modelo', async () => {
    const p = await personaNueva('Voz · tope');
    await conEmpresa({ empresaId: p.empresa, usuarioId: p.sesion.usuarioId }, (tx) =>
      tx.execute(sql`insert into core.agente_configuracion (tenant_id, tope_mensual_microusd, actualizado_por) values (${p.empresa}, 0, 'prueba')`),
    );
    const antes = transcriptor.recibidos;
    const r = await transcribir(p);
    expect(r.estado).toBe(429);
    expect(r.cuerpo.error.codigo).toBe('tope_mensual');
    expect(transcriptor.recibidos).toBe(antes);
    expect(await usoDe(p)).toEqual([]);
  });

  it(`el ritmo es de ${LIMITE_DE_CAPTURAS_POR_MINUTO} por minuto y aguanta peticiones simultáneas`, async () => {
    const p = await personaNueva('Voz · ritmo');
    const antes = transcriptor.recibidos;
    const r = await Promise.all(Array.from({ length: LIMITE_DE_CAPTURAS_POR_MINUTO + 4 }, () => transcribir(p)));
    const estados = r.map((x) => x.estado);
    expect(estados.filter((e) => e === 200)).toHaveLength(LIMITE_DE_CAPTURAS_POR_MINUTO);
    expect(estados.filter((e) => e === 429)).toHaveLength(4);
    expect(r.find((x) => x.estado === 429)?.cuerpo.error.codigo).toBe('demasiados_intentos');
    expect(transcriptor.recibidos - antes).toBe(LIMITE_DE_CAPTURAS_POR_MINUTO);
  });

  it('otra persona de la misma empresa tiene su propio ritmo', async () => {
    const p = await personaNueva('Voz · ritmo propio');
    await conEmpresa({ empresaId: p.empresa, usuarioId: 'otra-persona' }, async (tx) => {
      for (let i = 0; i < LIMITE_DE_CAPTURAS_POR_MINUTO; i++) {
        await tx.execute(sql`insert into core.uso (tenant_id, usuario_id, origen, turno_id, modelo) values (${p.empresa}, 'otra-persona', 'captura', gen_random_uuid(), 'simulado/voz')`);
      }
    });
    expect((await transcribir(p)).estado).toBe(200);
  });
});

describe('ServicioDeTranscripcion con el asistente apagado', () => {
  it('rechaza con «apagado» sin tocar la base ni el transcriptor', async () => {
    const config = { ...app.obtener<Config>(CONFIG), AGENTE_PROVEEDOR: 'apagado' as const };
    const servicio = new ServicioDeTranscripcion(config, app.obtener(DatabaseService), transcriptor, app.obtener<Logger>(LOGGER));
    const antes = transcriptor.recibidos;
    const r = await servicio.transcribir({ requestId: 'prueba', empresaId: 'emp_x', usuarioId: 'u_x' }, { audioBase64: UN_SEGUNDO, formato: 'wav' });
    expect(r).toEqual({ ok: false, error: { codigo: 'apagado', mensaje: 'El dictado por voz no está activo en este sistema. Escribe el texto.' } });
    expect(transcriptor.recibidos).toBe(antes);
  });
});
