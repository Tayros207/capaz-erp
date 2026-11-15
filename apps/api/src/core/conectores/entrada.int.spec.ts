import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirPool, comoEmpresa, empresaDePrueba } from '../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { firmaDeEntrada, generarClaveDeApi } from './firma.js';

// Fase 11a-1: ruta pública de entrada de webhooks, por HTTP real contra la base de pruebas.

let servidor: AppDePruebas;
let app: pg.Pool;
let E: string;
let clave: ReturnType<typeof generarClaveDeApi>;

beforeAll(async () => {
  app = abrirPool('app');
  servidor = await levantarApp();
});
afterAll(async () => {
  await servidor.cerrar();
  await app.end();
});

async function crearClave(empresa: string, alcance = ['entrada'], revocada = false) {
  const k = generarClaveDeApi();
  await comoEmpresa(
    app,
    empresa,
    (c) =>
      c.query(
        `insert into core.claves_api (hash, tenant_id, nombre, prefijo, alcance, creado_por, revocada_en)
         values ($1, $2, 'prueba', $3, $4::text[], 'u1', ${revocada ? 'now()' : 'null'})`,
        [k.hash, empresa, k.prefijo, `{${alcance.join(',')}}`],
      ),
    { confirmar: true },
  );
  return k;
}
beforeEach(async () => {
  E = empresaDePrueba();
  clave = await crearClave(E);
});

const filas = (sql: string, e = E) => comoEmpresa(app, e, async (c) => (await c.query(sql)).rows);
type Opciones = { clave?: string | null; idempotencia?: string | null; cuerpo?: unknown; crudo?: string; firma?: string };
async function enviar(evento: string, o: Opciones = {}) {
  const cuerpo = o.crudo ?? JSON.stringify(o.cuerpo ?? { pedido: 123, total: 50 });
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const k = o.clave === undefined ? clave.clave : o.clave;
  if (k) headers.authorization = `Bearer ${k}`;
  const idem = o.idempotencia === undefined ? 'id-1' : o.idempotencia;
  if (idem) headers['idempotency-key'] = idem;
  if (o.firma) headers['x-capaz-firma'] = o.firma;
  const res = await fetch(`${servidor.url}/api/v1/entrada/${evento}`, { method: 'POST', headers, body: cuerpo });
  return { estado: res.status, cuerpo: (await res.json()) as any };
}

describe('POST /api/v1/entrada/:evento', () => {
  it('guarda el webhook en la empresa dueña de la clave y emite webhook.recibido con el nombre del evento', async () => {
    const r = await enviar('pedido.pagado', { cuerpo: { pedido: 7 } });
    expect(r.estado).toBe(200);
    expect(r.cuerpo).toMatchObject({ ok: true, datos: { evento: 'pedido.pagado' } });
    const [fila] = await filas('select * from core.webhooks_entrantes');
    expect(fila).toMatchObject({ evento: 'pedido.pagado', clave_idempotencia: 'id-1', carga: { pedido: 7 } });
    expect(fila.procesado_en).not.toBeNull();
    expect(fila.id).toBe(r.cuerpo.datos.id);
    const eventos = await filas(`select tipo, carga from core.eventos_salida where tipo = 'webhook.recibido'`);
    expect(eventos).toHaveLength(1);
    // Contrato con las automatizaciones (S8): la carga del evento trae `evento` (el nombre de entrada).
    expect(eventos[0].carga).toEqual({ evento: 'pedido.pagado', entradaId: fila.id, carga: { pedido: 7 } });
    expect(JSON.stringify(r)).not.toContain(clave.clave);
  });

  it('un envío repetido responde lo mismo y se guarda una sola vez', async () => {
    const a = await enviar('pedido.pagado');
    const b = await enviar('pedido.pagado', { cuerpo: { otro: 'contenido' } });
    expect(b.estado).toBe(200);
    expect(b.cuerpo).toEqual(a.cuerpo);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(1);
    expect(await filas(`select * from core.eventos_salida where tipo = 'webhook.recibido'`)).toHaveLength(1);
    const c = await enviar('pedido.pagado', { idempotencia: 'id-2' });
    expect(c.cuerpo.datos.id).not.toBe(a.cuerpo.datos.id);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(2);
  });

  it('la misma clave de idempotencia en otra empresa es independiente', async () => {
    const otra = empresaDePrueba();
    const k2 = await crearClave(otra);
    await enviar('x.y');
    const r = await enviar('x.y', { clave: k2.clave });
    expect(r.estado).toBe(200);
    expect(await filas('select * from core.webhooks_entrantes', otra)).toHaveLength(1);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(1);
  });

  it('sin clave, con clave falsa, mal formada o revocada: no entra y no guarda nada', async () => {
    const revocada = await crearClave(E, ['entrada'], true);
    for (const k of [null, clave.clave.slice(0, -1) + (clave.clave.endsWith('A') ? 'B' : 'A'), 'basura', revocada.clave]) {
      const r = await enviar('x.y', { clave: k });
      expect(r.estado, String(k)).toBe(401);
      expect(r.cuerpo).toMatchObject({ ok: false, error: { codigo: 'no_autenticado' } });
    }
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(0);
  });

  it('una clave sin el alcance «entrada» no entra', async () => {
    const k = await crearClave(E, ['otro']);
    expect((await enviar('x.y', { clave: k.clave })).estado).toBe(403);
  });

  it('exige Idempotency-Key, un nombre de evento válido y un cuerpo objeto', async () => {
    expect((await enviar('x.y', { idempotencia: null })).estado).toBe(400);
    expect((await enviar('x.y', { idempotencia: 'con espacios' })).estado).toBe(400);
    expect((await enviar('evento%20con%20espacio')).estado).toBe(400);
    expect((await enviar('x.y', { crudo: '[1,2]' })).estado).toBe(400);
    expect((await enviar('x.y', { crudo: '"texto"' })).estado).toBe(400);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(0);
  });

  it('el cuerpo se limita a 256 KB', async () => {
    const r = await enviar('x.y', { cuerpo: { relleno: 'a'.repeat(300_000) } });
    expect(r.estado).toBe(413);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(0);
  });

  it('firma opcional: si llega debe ser el HMAC del cuerpo con el hash de la clave', async () => {
    const cuerpo = JSON.stringify({ monto: 10 });
    const bien = await enviar('x.y', { crudo: cuerpo, firma: firmaDeEntrada(clave.hash, cuerpo), idempotencia: 'f1' });
    expect(bien.estado).toBe(200);
    const alterado = await enviar('x.y', { crudo: JSON.stringify({ monto: 11 }), firma: firmaDeEntrada(clave.hash, cuerpo), idempotencia: 'f2' });
    expect(alterado.estado).toBe(401);
    const otra = await enviar('x.y', { crudo: cuerpo, firma: firmaDeEntrada('otro-hash', cuerpo), idempotencia: 'f3' });
    expect(otra.estado).toBe(401);
    const basura = await enviar('x.y', { crudo: cuerpo, firma: 'sha256=', idempotencia: 'f4' });
    expect(basura.estado).toBe(401);
    expect(await filas('select * from core.webhooks_entrantes')).toHaveLength(1);
  });

  it('anota el último uso de la clave sin dejarla ver', async () => {
    await enviar('x.y');
    await new Promise((r) => setTimeout(r, 100));
    expect((await filas('select ultimo_uso_en from core.claves_api'))[0].ultimo_uso_en).not.toBeNull();
  });

  it('tras muchos intentos fallidos desde un mismo origen responde 429 (va al final: el límite es de la aplicación)', async () => {
    let ultimo = 0;
    for (let i = 0; i < 40; i++) ultimo = (await enviar('x.y', { clave: 'basura' })).estado;
    expect(ultimo).toBe(429);
  });
});
