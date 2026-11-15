import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import type { Respuesta } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { DatabaseService } from '../../infra/database/database.service.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { EscritorDeAuditoria } from '../../core/auditoria/escritor.js';
import { Cifrador } from '../../core/conectores/cifrado.js';
import { firmarEnvio } from '../../core/conectores/firma.js';
import { emitir } from '../../core/eventos/emisor.js';
import { MAX_INTENTOS } from '../../core/eventos/relevo.js';
import type { EventoEntregado } from '../../core/eventos/tipos.js';
import { EjecutorDeHerramientas } from '../../core/herramientas/ejecutor.js';
import { acceso, codigoDe, contextoDePrueba, SECRETO } from '../../core/herramientas/pruebas-del-ejecutor.js';
import { registroDePrueba } from '../../core/herramientas/pruebas.js';
import type { ContextoDeHerramienta } from '../../core/herramientas/tipos.js';
import { EntregaDeWebhooks, MAX_ENVIOS_POR_MINUTO } from './entrega.js';
import { crearHerramientasDeWebhooks } from './herramientas-de-webhooks.js';
import * as repo from './repositorio.js';

// Fase 11a-1: webhooks de salida contra PostgreSQL real y un servidor simulado de node:http.

type Peticion = { metodo: string; url: string; headers: IncomingHttpHeaders; cuerpo: string };

let app: pg.Pool;
let sistema: pg.Pool;
let conEmpresa: ReturnType<typeof conEmpresaDePruebas>;
let ejecutor: EjecutorDeHerramientas;
let entrega: EntregaDeWebhooks;
let servidor: Server;
let puerto: number;
let recibidas: Peticion[];
let estados: number[];
let E: string;
let resolucion: string[] | null;

const PERMISOS = ['conexiones:ver', 'conexiones:gestionar'];
const URL_LOCAL = () => `http://127.0.0.1:${puerto}/hook`;

beforeAll(async () => {
  app = abrirPool('app');
  sistema = abrirPool('sistema');
  conEmpresa = conEmpresaDePruebas(app);
  const cifrador = new Cifrador(new Map([[1, randomBytes(32)]]), 1);
  const db = { conEmpresa, sistema } as unknown as DatabaseService;
  entrega = new EntregaDeWebhooks(db, { PERMITIR_DESTINOS_LOCALES: true }, cifrador);
  const registro = registroDePrueba(crearHerramientasDeWebhooks(entrega, cifrador));
  ejecutor = new EjecutorDeHerramientas(registro, db, new EscritorDeAuditoria(db), { CONFIRMACION_SECRET: SECRETO }, { error: () => undefined } as never);
  servidor = createServer((req, res) => {
    const trozos: Buffer[] = [];
    req.on('data', (t: Buffer) => trozos.push(t));
    req.on('end', () => {
      recibidas.push({ metodo: req.method!, url: req.url!, headers: req.headers, cuerpo: Buffer.concat(trozos).toString() });
      const estado = estados.shift() ?? 200;
      if (estado === 302) res.writeHead(302, { location: 'http://127.0.0.1:9/otra-parte' });
      else res.writeHead(estado);
      res.end('ok');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = (servidor.address() as { port: number }).port;
});
afterAll(async () => {
  await new Promise((r) => servidor.close(r));
  await Promise.all([app.end(), sistema.end()]);
});
beforeEach(() => {
  E = empresaDePrueba();
  recibidas = [];
  estados = [];
  resolucion = null;
});

const ctx = (c: Partial<ContextoDeHerramienta> = {}) => contextoDePrueba(E, { permisos: PERMISOS, modulos: [acceso('core'), acceso('webhooks')], ...c });
const llamar = (n: string, a: unknown, c: Partial<ContextoDeHerramienta> = {}) => ejecutor.ejecutar(n, a, { ctx: ctx(c) });
const datos = <T>(r: Respuesta<unknown>): T => {
  if (!r.ok || !('datos' in r)) throw new Error(`Se esperaba éxito: ${JSON.stringify(r)}`);
  return r.datos as T;
};
const filas = (sql: string, e = E) => comoEmpresa(app, e, async (c) => (await c.query(sql)).rows);

type Creado = { id: string; secreto: string; url: string };
const crear = async (eventos = ['cliente.creado'], url = URL_LOCAL()) => datos<Creado>(await llamar('webhooks_salientes_crear', { nombre: 'Destino', url, eventos }));

/** Un evento real en `eventos_salida` (como lo deja `emitir`), con la forma que entrega el relevo. */
async function nuevoEvento(carga: Record<string, unknown> = { evento: 'x', entradaId: randomUUID(), carga: { a: 1 } }): Promise<EventoEntregado> {
  await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => emitir(tx, 'webhook.recibido', carga as never));
  const [f] = await filas(`select id, tipo, carga, creado_en from core.eventos_salida order by creado_en desc, id desc limit 1`);
  return { id: f.id, tipo: 'cliente.creado' as never, carga: f.carga, creadoEn: new Date(f.creado_en) };
}
/** Lo que hace el relevo: una transacción por consumidor; si lanza, se revierte. */
const entregar = (e: EventoEntregado) => conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx: Transaccion) => entrega.alEvento(e, E, tx));
const envios = () => filas('select * from core.webhooks_envios order by creado_en, id');

describe('webhooks de salida: crear y listar', () => {
  it('el secreto se muestra una vez; después ni la lista ni la base lo traen en claro', async () => {
    const w = await crear();
    expect(w.secreto.length).toBeGreaterThanOrEqual(32);
    const lista = await llamar('webhooks_salientes_listar', {});
    expect(JSON.stringify(lista)).not.toContain(w.secreto);
    expect(datos<{ items: unknown[] }>(lista).items).toHaveLength(1);
    const [fila] = await filas('select * from core.webhooks_salientes');
    expect(JSON.stringify(fila)).not.toContain(w.secreto);
    expect(fila.secreto_cifrado).toMatch(/^v1\./);
    expect(JSON.stringify(await filas('select * from core.auditoria'))).not.toContain(w.secreto);
  });

  it('rechaza destinos privados, locales, de metadatos y no https (con el permiso de pruebas apagado)', async () => {
    const db = { conEmpresa, sistema } as unknown as DatabaseService;
    const cifrador = new Cifrador(new Map([[1, randomBytes(32)]]), 1);
    const estricta = new EntregaDeWebhooks(db, { PERMITIR_DESTINOS_LOCALES: false }, cifrador, async () => resolucion ?? ['93.184.216.34']);
    const e2 = new EjecutorDeHerramientas(registroDePrueba(crearHerramientasDeWebhooks(estricta, cifrador)), db, new EscritorDeAuditoria(db), { CONFIRMACION_SECRET: SECRETO }, { error: () => undefined } as never);
    const intentar = (url: string) => e2.ejecutar('webhooks_salientes_crear', { nombre: 'x', url, eventos: ['*'] }, { ctx: ctx() });
    for (const url of ['https://127.0.0.1/', 'https://10.0.0.1/x', 'https://169.254.169.254/latest', 'https://[::1]/', 'http://ejemplo.com/', 'https://u:p@ejemplo.com/', 'ftp://ejemplo.com']) {
      expect(codigoDe(await intentar(url)), url).toBe('argumentos_invalidos');
    }
    resolucion = ['10.0.0.8'];
    expect(codigoDe(await intentar('https://interno.ejemplo.com/'))).toBe('argumentos_invalidos');
    resolucion = null;
    expect((await intentar('https://publico.ejemplo.com/hook')).ok).toBe(true);
    expect(await filas('select url from core.webhooks_salientes')).toEqual([{ url: 'https://publico.ejemplo.com/hook' }]);
  });

  it('exige el módulo, el permiso y valida los eventos', async () => {
    const args = { nombre: 'x', url: URL_LOCAL(), eventos: ['cliente.creado'] };
    expect(codigoDe(await llamar('webhooks_salientes_crear', args, { modulos: [acceso('core')] }))).toBe('modulo_no_disponible');
    expect(codigoDe(await llamar('webhooks_salientes_crear', args, { permisos: ['conexiones:ver'] }))).toBe('sin_permiso');
    expect(codigoDe(await llamar('webhooks_salientes_crear', { ...args, eventos: ['Cliente Creado'] }))).toBe('argumentos_invalidos');
    expect(codigoDe(await llamar('webhooks_salientes_crear', { ...args, eventos: [] }))).toBe('argumentos_invalidos');
  });

  it('editar, rotar el secreto (se muestra una vez) y archivar', async () => {
    const w = await crear();
    const e = datos<{ secreto?: string; nombre: string }>(await llamar('webhooks_salientes_editar', { id: w.id, nombre: 'Nuevo', rotarSecreto: true, eventos: ['*'] }));
    expect(e.nombre).toBe('Nuevo');
    expect(e.secreto).toBeDefined();
    expect(e.secreto).not.toBe(w.secreto);
    expect(datos<{ secreto?: string }>(await llamar('webhooks_salientes_editar', { id: w.id, nombre: 'Otro' })).secreto).toBeUndefined();
    expect(datos<{ activo: boolean }>(await llamar('webhooks_salientes_archivar', { id: w.id })).activo).toBe(false);
    expect(codigoDe(await llamar('webhooks_salientes_archivar', { id: randomUUID() }))).toBe('no_encontrado');
  });

  it('una empresa no ve los webhooks ni los envíos de otra', async () => {
    await crear();
    expect(await filas('select * from core.webhooks_salientes', empresaDePrueba())).toHaveLength(0);
    const otra = await ejecutor.ejecutar('webhooks_salientes_listar', {}, { ctx: contextoDePrueba(empresaDePrueba(), { permisos: PERMISOS }) });
    expect(datos<{ items: unknown[] }>(otra).items).toHaveLength(0);
  });
});

describe('envío firmado al servidor simulado', () => {
  it('llega firmado con HMAC-SHA256 del secreto, con el evento y la carga; queda enviado', async () => {
    const w = await crear();
    const ev = await nuevoEvento();
    await entregar(ev);
    expect(recibidas).toHaveLength(1);
    const p = recibidas[0]!;
    expect(p).toMatchObject({ metodo: 'POST', url: '/hook' });
    expect(p.headers['content-type']).toBe('application/json');
    expect(p.headers['x-capaz-evento']).toBe('cliente.creado');
    const marca = Number(p.headers['x-capaz-marca-de-tiempo']);
    expect(Math.abs(Date.now() / 1000 - marca)).toBeLessThan(30);
    expect(p.headers['x-capaz-firma']).toBe(firmarEnvio(w.secreto, marca, p.cuerpo));
    expect(p.headers['x-capaz-firma']).not.toBe(firmarEnvio('otro-secreto', marca, p.cuerpo));
    expect(JSON.parse(p.cuerpo)).toMatchObject({ id: ev.id, tipo: 'cliente.creado', carga: ev.carga });
    expect(JSON.stringify(p.headers)).not.toContain(w.secreto);
    const [envio] = await envios();
    expect(envio).toMatchObject({ estado: 'enviado', intentos: 1, codigo_http: 200, ultimo_error: null });
    expect(envio.enviado_en).not.toBeNull();
  });

  it('un evento repetido no se vuelve a enviar (lo ya enviado no se repite)', async () => {
    await crear();
    const ev = await nuevoEvento();
    await entregar(ev);
    await entregar(ev);
    expect(recibidas).toHaveLength(1);
    expect(await envios()).toHaveLength(1);
  });

  it('solo recibe los eventos que coinciden: exacto, familia o todo; los apagados no', async () => {
    await crear(['cliente.creado']);
    await crear(['cliente.*']);
    await crear(['*']);
    await crear(['producto.creado']);
    const apagado = await crear(['*']);
    await llamar('webhooks_salientes_archivar', { id: apagado.id });
    await entregar(await nuevoEvento());
    expect(recibidas).toHaveLength(3);
  });

  it('si uno falla lanza (el relevo reintenta), conserva lo enviado y el reintento solo repite lo que falló', async () => {
    const bueno = await crear();
    const malo = await crear();
    const ev = await nuevoEvento();
    // Orden de creación: primero `bueno` (200), luego `malo` (500).
    estados = [200, 500];
    await expect(entregar(ev)).rejects.toThrow(/Falló el envío/);
    const e1 = await envios();
    expect(e1.find((e) => e.webhook_id === bueno.id)).toMatchObject({ estado: 'enviado', intentos: 1 });
    expect(e1.find((e) => e.webhook_id === malo.id)).toMatchObject({ estado: 'pendiente', intentos: 1, codigo_http: 500, ultimo_error: 'http_500' });
    expect(recibidas).toHaveLength(2);
    // Reintento del relevo: el destino ya funciona; solo se envía al que faltaba.
    await entregar(ev);
    expect(recibidas).toHaveLength(3);
    expect((await envios()).map((e) => e.estado)).toEqual(['enviado', 'enviado']);
  });

  it('los errores no llevan la URL ni el secreto', async () => {
    const w = await crear();
    estados = [503];
    const error = await entregar(await nuevoEvento()).catch((e: Error) => e);
    expect(String((error as Error).message)).not.toContain(w.secreto);
    expect(String((error as Error).message)).not.toContain(String(puerto));
    const [fila] = await filas('select ultimo_error from core.webhooks_salientes');
    expect(fila.ultimo_error).toBe('http_503');
  });

  it('tras el máximo de intentos queda fallido y deja de lanzar', async () => {
    await crear();
    const ev = await nuevoEvento();
    estados = Array(MAX_INTENTOS).fill(500);
    for (let i = 0; i < MAX_INTENTOS - 1; i++) await expect(entregar(ev)).rejects.toThrow();
    await expect(entregar(ev)).rejects.toThrow();
    expect((await envios())[0]).toMatchObject({ estado: 'fallido', intentos: MAX_INTENTOS });
    await expect(entregar(ev)).resolves.toBeUndefined();
    expect(recibidas).toHaveLength(MAX_INTENTOS);
  });

  it('no sigue redirecciones', async () => {
    await crear();
    estados = [302];
    await expect(entregar(await nuevoEvento())).rejects.toThrow();
    expect(recibidas).toHaveLength(1);
    expect((await envios())[0]).toMatchObject({ estado: 'pendiente', ultimo_error: 'redireccion_no_permitida', codigo_http: 302 });
  });

  it('un destino que cae a una red privada después de crearlo no se envía (cambio de DNS)', async () => {
    const db = { conEmpresa, sistema } as unknown as DatabaseService;
    const cifrador = new Cifrador(new Map([[1, randomBytes(32)]]), 1);
    const estricta = new EntregaDeWebhooks(db, { PERMITIR_DESTINOS_LOCALES: false }, cifrador, async () => resolucion ?? ['93.184.216.34']);
    const registro = registroDePrueba(crearHerramientasDeWebhooks(estricta, cifrador));
    const e2 = new EjecutorDeHerramientas(registro, db, new EscritorDeAuditoria(db), { CONFIRMACION_SECRET: SECRETO }, { error: () => undefined } as never);
    const w = datos<Creado>(await e2.ejecutar('webhooks_salientes_crear', { nombre: 'x', url: 'https://rebind.ejemplo.com/h', eventos: ['*'] }, { ctx: ctx() }));
    resolucion = ['127.0.0.1'];
    const ev = await nuevoEvento();
    await expect(conEmpresa({ empresaId: E, usuarioId: 'sistema' }, (tx) => estricta.alEvento(ev, E, tx))).rejects.toThrow();
    expect((await envios())[0]).toMatchObject({ webhook_id: w.id, estado: 'pendiente', ultimo_error: 'destino_no_permitido', codigo_http: null });
    expect(recibidas).toHaveLength(0);
  });

  it('tope por webhook y minuto, contado en la base', async () => {
    const w = await crear();
    await conEmpresa({ empresaId: E, usuarioId: 'sistema' }, async (tx) => {
      for (let i = 0; i < MAX_ENVIOS_POR_MINUTO; i++) await repo.asegurarEnvio(tx, w.id, randomUUID(), 'cliente.creado');
    });
    await expect(entregar(await nuevoEvento())).rejects.toThrow(/limite_por_minuto/);
    expect(recibidas).toHaveLength(0);
  });
});

describe('cola de envíos y reintento manual', () => {
  it('lista los envíos con su estado y reintenta uno fallido; uno enviado no se repite', async () => {
    const w = await crear();
    const ev = await nuevoEvento();
    estados = [500];
    await expect(entregar(ev)).rejects.toThrow();
    const lista = datos<{ items: { id: string; estado: string; intentos: number }[] }>(await llamar('webhook_envios_listar', { estado: 'pendiente', webhookId: w.id }));
    expect(lista.items).toHaveLength(1);
    const id = lista.items[0]!.id;
    const r = datos<{ estado: string; intentos: number }>(await llamar('webhook_envio_reintentar', { id }));
    expect(r).toMatchObject({ estado: 'enviado', intentos: 1 });
    expect(recibidas).toHaveLength(2);
    expect(codigoDe(await llamar('webhook_envio_reintentar', { id }))).toBe('conflicto');
    expect(recibidas).toHaveLength(2);
    expect(codigoDe(await llamar('webhook_envio_reintentar', { id: randomUUID() }))).toBe('no_encontrado');
  });

  it('pagina la lista con cursor', async () => {
    await crear();
    for (let i = 0; i < 3; i++) await entregar(await nuevoEvento());
    const p1 = datos<{ items: { id: string }[]; siguiente: string | null }>(await llamar('webhook_envios_listar', { limite: 2 }));
    expect(p1.items).toHaveLength(2);
    expect(p1.siguiente).not.toBeNull();
    const p2 = datos<{ items: { id: string }[]; siguiente: string | null }>(await llamar('webhook_envios_listar', { limite: 2, cursor: p1.siguiente! }));
    expect(p2.items).toHaveLength(1);
    expect(p2.siguiente).toBeNull();
    expect(codigoDe(await llamar('webhook_envios_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});
