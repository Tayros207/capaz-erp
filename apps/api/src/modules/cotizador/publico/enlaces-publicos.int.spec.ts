import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, manual } from '../herramientas/pruebas-de-cotizador.js';

// Enlace público por HTTP real: generar → ver → aprobar o rechazar, sin sesión, y todo lo que NO debe pasar.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let otra: Sesion;
let empresaId: string;
let clienteId: string;
let futuro = Date.now() + 3_600_000;

const COSTO_SECRETO_CENTIMOS = 9_876_5;
const NO_DISPONIBLE = 'Esta cotización ya no está disponible';

async function drenar(): Promise<void> {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const pendientes = async (): Promise<any[]> => (await datosDe(dueno, 'borradores_listar', { modulo: 'ordenes', estado: 'pendiente', limite: 100 })).items;

type Quote = { id: string; codigo: string };
async function cotizar(titulo: string, lineas: unknown[], extra: Record<string, unknown> = {}): Promise<Quote> {
  const c = await datosDe(dueno, 'cotizacion_crear', { titulo, clienteId, lineas, costoCentimos: COSTO_SECRETO_CENTIMOS, ...extra });
  const e = (await confirmando(dueno, 'cotizacion_emitir', { id: c.id, motivoMargenBajo: 'Prueba' })).respuesta.cuerpo.datos;
  return { id: c.id, codigo: e.codigo };
}
async function enlazar(id: string, dias?: number): Promise<{ token: string; url: string; enlaceId: string }> {
  const { respuesta, resumen } = await confirmando(dueno, 'enlace_generar', dias ? { id, diasDeVigencia: dias } : { id });
  if (!respuesta.cuerpo?.ok) throw new Error(`enlace_generar respondió ${respuesta.estado}: ${JSON.stringify(respuesta.cuerpo)}`);
  expect(resumen).toContain('¿Envío la cotización');
  const url: string = respuesta.cuerpo.datos.url;
  return { token: url.split('/').at(-1)!, url, enlaceId: respuesta.cuerpo.datos.enlace.id };
}
const ruta = (token: string, resto = '') => `${app.url}/api/v1/c/${token}${resto}`;
const ver = (token: string, resto = '') => fetch(ruta(token, resto), { redirect: 'manual' });
const enviar = (token: string, accion: 'aprobar' | 'rechazar', cuerpo: string) =>
  fetch(ruta(token, `/${accion}`), { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: cuerpo });
const vistaDe = async (id: string) => datosDe(dueno, 'cotizacion_ver', { id });
const sobreEnlaces = (sentencia: string, params: unknown[] = []) => comoEmpresa(appPool, empresaId, async (c) => (await c.query(sentencia, params)).rows, { confirmar: true });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  dueno = await abrirSesion(app, 'Dueña del enlace público');
  empresaId = await crearEmpresa(dueno, 'Gráfica del enlace público');
  for (const modulo of ['registro', 'ordenes', 'cotizador']) await activarModulo(empresaId, modulo);
  await datosDe(dueno, 'registro_iniciar');
  await datosDe(dueno, 'cotizador_iniciar');
  clienteId = await crearCliente(dueno, 'Cristina Rojas');
  otra = await abrirSesion(app, 'Otra empresa del enlace');
  const otraId = await crearEmpresa(otra, 'Imprenta ajena');
  await activarModulo(otraId, 'cotizador');
  await datosDe(otra, 'cotizador_iniciar');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('generar y ver', () => {
  let q: Quote;
  let e: { token: string; url: string; enlaceId: string };

  it('genera el enlace: pide confirmación, devuelve el token una vez, guarda solo su sha256 y pasa la cotización a enviada', async () => {
    q = await cotizar('Volantes del enlace', [manual('Volantes A5 4/4', 346.38, 2500)]);
    e = await enlazar(q.id);
    expect(e.url.startsWith(`${app.url}/api/v1/c/`)).toBe(true);
    expect(e.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const [fila] = await sobreEnlaces('select token_hash, version from cotizador.enlaces where id = $1', [e.enlaceId]);
    expect(fila.token_hash).toBe(createHash('sha256').update(e.token).digest('hex'));
    expect(fila.token_hash).not.toContain(e.token);
    expect((await vistaDe(q.id)).estado).toBe('enviada');
    const lista = await datosDe(dueno, 'enlaces_listar', { cotizacionId: q.id });
    expect(lista.items).toHaveLength(1);
    expect(JSON.stringify(lista)).not.toContain(e.token);
    expect(JSON.stringify(lista)).not.toContain(fila.token_hash);
  });

  it('GET muestra la cotización en HTML sin JavaScript, sin cachear, y sin costo, margen ni lista', async () => {
    const r = await ver(e.token);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/html');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
    const html = await r.text();
    expect(html).toContain(q.codigo);
    expect(html).toContain('Cristina Rojas');
    expect(html).toContain('Aprobar cotización');
    expect(html).toContain('Rechazar cotización');
    expect(html).not.toMatch(/<script|onclick|javascript:/i);
    expect(html).not.toMatch(/costo|margen|lista/i);
    expect(html).not.toContain('9876');
    expect(html).not.toContain('98,76');
  });

  it('cuenta la vista como máximo una vez por hora y deja un solo evento «vista» del canal enlace sin usuario', async () => {
    await ver(e.token);
    await ver(e.token);
    const [item] = (await datosDe(dueno, 'enlaces_listar', { cotizacionId: q.id })).items;
    expect(item.vistas).toBe(1);
    expect(item.ultimaVistaEn).not.toBeNull();
    const vistas = (await vistaDe(q.id)).historial.filter((h: any) => h.tipo === 'vista');
    expect(vistas).toHaveLength(1);
    expect(vistas[0]).toMatchObject({ canal: 'enlace', usuarioId: null });
  });

  it('/imprimir muestra la misma cotización sin formularios y no cuenta vista', async () => {
    const html = await (await ver(e.token, '/imprimir')).text();
    expect(html).toContain(q.codigo);
    expect(html).not.toContain('<form');
    expect((await datosDe(dueno, 'enlaces_listar', { cotizacionId: q.id })).items[0].vistas).toBe(1);
  });
});

describe('aprobar y rechazar', () => {
  it('aprobar: 303, la cotización queda aceptada por el canal enlace y Pedidos propone su borrador', async () => {
    const q = await cotizar('Aprobada por enlace', [manual('Banner 2x1', 120, 3)]);
    const e = await enlazar(q.id);
    const r = await enviar(e.token, 'aprobar', '');
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`/api/v1/c/${e.token}?a=aprobada`);
    const c = await vistaDe(q.id);
    expect(c.estado).toBe('aceptada');
    const aceptada = c.historial.filter((h: any) => h.tipo === 'aceptada');
    expect(aceptada).toHaveLength(1);
    expect(aceptada[0]).toMatchObject({ canal: 'enlace', usuarioId: null });
    await drenar();
    expect((await pendientes()).filter((b) => b.args.origenId === q.id)).toHaveLength(1);
    const despues = await (await ver(e.token, '?a=aprobada')).text();
    expect(despues).toContain('Aprobada');
    expect(despues).not.toContain('<form');
  });

  it('repetir la aprobación no cambia nada: sigue un solo evento y un solo borrador', async () => {
    const q = await cotizar('Repetida', [manual('Tarjetas', 40, 5)]);
    const e = await enlazar(q.id);
    await enviar(e.token, 'aprobar', '');
    const otra = await enviar(e.token, 'aprobar', '');
    expect(otra.status).toBe(303);
    expect(otra.headers.get('location')).toBe(`/api/v1/c/${e.token}?a=sin_cambio`);
    const rechazo = await enviar(e.token, 'rechazar', 'nota=tarde');
    expect(rechazo.headers.get('location')).toContain('a=sin_cambio');
    const c = await vistaDe(q.id);
    expect(c.estado).toBe('aceptada');
    expect(c.historial.filter((h: any) => h.tipo === 'aceptada')).toHaveLength(1);
    await drenar();
    expect((await pendientes()).filter((b) => b.args.origenId === q.id)).toHaveLength(1);
  });

  it('rechazar con nota: la guarda tal cual (como texto), queda rechazada y sin usuario', async () => {
    const q = await cotizar('Rechazada por enlace', [manual('Afiches', 15, 100)]);
    const e = await enlazar(q.id);
    const r = await enviar(e.token, 'rechazar', `nota=${encodeURIComponent('Muy caro <b>hoy</b>')}`);
    expect(r.headers.get('location')).toBe(`/api/v1/c/${e.token}?a=rechazada`);
    const c = await vistaDe(q.id);
    expect(c).toMatchObject({ estado: 'rechazada', motivoRechazo: 'Muy caro <b>hoy</b>' });
    expect(c.historial.find((h: any) => h.tipo === 'rechazada')).toMatchObject({ canal: 'enlace', usuarioId: null });
  });

  it('con opciones: sin elegir no aprueba; eligiendo una, solo esa queda aceptada', async () => {
    const q = await cotizar('Con opciones', [manual('Opción A', 100, 1), manual('Opción B', 200, 1)], { conOpciones: true });
    const e = await enlazar(q.id);
    const html = await (await ver(e.token)).text();
    expect(html).toContain('type="checkbox"');
    const sin = await enviar(e.token, 'aprobar', '');
    expect(sin.headers.get('location')).toContain('a=elige');
    expect((await vistaDe(q.id)).estado).toBe('enviada');
    await enviar(e.token, 'aprobar', 'posicion=1');
    expect(await vistaDe(q.id)).toMatchObject({ estado: 'aceptada', lineasAceptadas: [1] });
  });
});

describe('lo que no debe pasar', () => {
  it('inventado, vencido y revocado dan exactamente la misma página 404', async () => {
    const inventado = await ver(randomBytes(32).toString('base64url'));
    const corto = await ver('abc');
    const cuerpoInventado = await inventado.text();
    expect(inventado.status).toBe(404);
    expect(cuerpoInventado).toContain(NO_DISPONIBLE);
    expect(await corto.text()).toBe(cuerpoInventado);

    const q = await cotizar('Vence y se revoca', [manual('Sellos', 25, 10)]);
    const vencido = await enlazar(q.id);
    await sobreEnlaces(`update cotizador.enlaces set vence_en = now() - interval '1 minute' where id = $1`, [vencido.enlaceId]);
    const rv = await ver(vencido.token);
    expect(rv.status).toBe(404);
    expect(await rv.text()).toBe(cuerpoInventado);
    expect((await enviar(vencido.token, 'aprobar', '')).status).toBe(404);

    const revocado = await enlazar(q.id);
    await datosDe(dueno, 'enlace_revocar', { id: revocado.enlaceId });
    const rr = await ver(revocado.token);
    expect(rr.status).toBe(404);
    expect(await rr.text()).toBe(cuerpoInventado);
    expect((await enviar(revocado.token, 'rechazar', '')).status).toBe(404);
    expect((await vistaDe(q.id)).estado).toBe('enviada');
  });

  it('revocar es idempotente y deja un solo evento enlace_revocado', async () => {
    const q = await cotizar('Revocación', [manual('Stickers', 10, 50)]);
    const e = await enlazar(q.id);
    const a = await datosDe(dueno, 'enlace_revocar', { id: e.enlaceId });
    const b = await datosDe(dueno, 'enlace_revocar', { id: e.enlaceId });
    expect(a.estado).toBe('revocado');
    expect(b.revocadoEn).toBe(a.revocadoEn);
    expect((await vistaDe(q.id)).historial.filter((h: any) => h.tipo === 'enlace_revocado')).toHaveLength(1);
  });

  it('anular la cotización revoca sus enlaces vivos', async () => {
    const q = await cotizar('Se anula', [manual('Lonas', 80, 2)]);
    const e = await enlazar(q.id);
    const r = await confirmando(dueno, 'cotizacion_anular', { id: q.id, motivo: 'Cliente equivocado' });
    expect(r.respuesta.cuerpo.ok).toBe(true);
    expect((await ver(e.token)).status).toBe(404);
    expect((await datosDe(dueno, 'enlaces_listar', { cotizacionId: q.id })).items[0].estado).toBe('revocado');
  });

  it('un borrador no se puede enviar', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Borrador', clienteId, lineas: [manual('X', 1, 1)] });
    const r = await dueno.herramienta('enlace_generar', { id: c.id });
    expect(r.cuerpo.ok).toBe(false);
    expect(codigoDe(r)).toBe('conflicto');
  });

  it('el texto de la empresa y de las líneas sale escapado', async () => {
    const q = await cotizar('<img src=x onerror=alert(1)>', [manual('<script>alert(1)</script>', 10, 1)]);
    const e = await enlazar(q.id);
    const html = await (await ver(e.token)).text();
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('otra empresa no ve ni revoca el enlace', async () => {
    const q = await cotizar('Aislada', [manual('Tazas', 30, 12)]);
    const e = await enlazar(q.id);
    const lista = await otra.herramienta('enlaces_listar', { cotizacionId: q.id });
    expect(codigoDe(lista)).toBe('no_encontrado');
    const rev = await otra.herramienta('enlace_revocar', { id: e.enlaceId });
    expect(codigoDe(rev)).toBe('no_encontrado');
    expect((await ver(e.token)).status).toBe(200);
  });

  it('30 intentos fallidos desde un mismo origen lo bloquean, también para un enlace bueno', async () => {
    const q = await cotizar('Bloqueo', [manual('Llaveros', 5, 20)]);
    const e = await enlazar(q.id);
    const estados: number[] = [];
    for (let i = 0; i < 40; i++) estados.push((await ver(randomBytes(32).toString('base64url'))).status);
    const primero = estados.indexOf(429);
    expect(primero).toBeGreaterThan(0);
    expect(primero).toBeLessThanOrEqual(30);
    expect(estados.slice(0, primero).every((s) => s === 404)).toBe(true);
    const bueno = await ver(e.token);
    expect(bueno.status).toBe(429);
    expect(bueno.headers.get('retry-after')).toBe('60');
  });
});
