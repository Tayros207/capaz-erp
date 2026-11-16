import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolverDestino } from './destinos.js';
import { enviarJson } from './enviar.js';

// Envío con nombre de host (Node 24 llama al `lookup` con `{ all: true }`): se valida la IP antes y se conecta a
// esa IP, sin segundo DNS. El resolver inyectado hace que el nombre «hook.ejemplo.test» apunte a 127.0.0.1.

let servidor: http.Server;
let puerto: number;
let recibido: { host: string | undefined; cuerpo: string }[] = [];
let modo: 'ok' | 'redireccion' = 'ok';

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    let cuerpo = '';
    req.on('data', (c) => (cuerpo += c));
    req.on('end', () => {
      recibido.push({ host: req.headers.host, cuerpo });
      if (modo === 'redireccion') res.writeHead(302, { location: 'http://127.0.0.1:1/otro' }).end();
      else res.writeHead(200).end('ok');
    });
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  puerto = (servidor.address() as AddressInfo).port;
});
afterAll(() => new Promise<void>((r) => servidor.close(() => r())));

describe('envío a un nombre de host', () => {
  it('conecta a la IP validada y entrega el cuerpo (reproduce ERR_INVALID_IP_ADDRESS)', async () => {
    let consultas = 0;
    const resolver = async () => {
      consultas++;
      return ['127.0.0.1'];
    };
    modo = 'ok';
    recibido = [];
    const destino = await resolverDestino(`http://hook.ejemplo.test:${puerto}/x`, { permitirLocales: true, resolver });
    expect(destino.direccion).toBe('127.0.0.1');
    const r = await enviarJson(destino, '{"a":1}', {});
    expect(r).toEqual({ ok: true, codigoHttp: 200, error: null });
    expect(recibido).toHaveLength(1);
    expect(recibido[0]!.cuerpo).toBe('{"a":1}');
    expect(recibido[0]!.host).toBe(`hook.ejemplo.test:${puerto}`);
    expect(consultas).toBe(1); // un solo DNS: el de la validación
  });

  it('no sigue redirecciones', async () => {
    modo = 'redireccion';
    const destino = await resolverDestino(`http://hook.ejemplo.test:${puerto}/x`, { permitirLocales: true, resolver: async () => ['127.0.0.1'] });
    expect(await enviarJson(destino, '{}', {})).toEqual({ ok: false, codigoHttp: 302, error: 'redireccion_no_permitida' });
  });

  it('un destino con IP literal sigue funcionando', async () => {
    modo = 'ok';
    const destino = await resolverDestino(`http://127.0.0.1:${puerto}/x`, { permitirLocales: true });
    expect((await enviarJson(destino, '{}', {})).ok).toBe(true);
  });
});
