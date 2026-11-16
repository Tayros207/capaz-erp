import http from 'node:http';
import https from 'node:https';
import type { DestinoValido } from './destinos.js';

// Envío HTTP de un cuerpo JSON a un destino ya validado. Se conecta a la dirección validada (sin volver a
// resolver el nombre: evita el cambio de DNS entre la validación y el envío), no sigue redirecciones, limita
// el tiempo y descarta el cuerpo de la respuesta. Los errores salen con un código fijo: nunca con la URL.

export const TIEMPO_DE_ESPERA_MS = 10_000;

export type ResultadoDeEnvio = { ok: boolean; codigoHttp: number | null; error: string | null };

export function enviarJson(d: DestinoValido, cuerpo: string, cabeceras: Record<string, string>, tiempoMs = TIEMPO_DE_ESPERA_MS): Promise<ResultadoDeEnvio> {
  const { url } = d;
  const cliente = url.protocol === 'https:' ? https : http;
  return new Promise((resolver) => {
    let terminado = false;
    const fin = (r: ResultadoDeEnvio) => {
      if (terminado) return;
      terminado = true;
      resolver(r);
    };
    const req = cliente.request(
      {
        method: 'POST',
        hostname: url.hostname.replace(/^\[|\]$/g, ''),
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        servername: url.hostname.replace(/^\[|\]$/g, ''),
        // Conecta a la dirección ya validada.
        // Node 24 llama con `{ all: true }` y espera una lista; con `all` falso espera (dirección, familia).
        lookup: (_h: string, o: { all?: boolean } | undefined, cb: (...a: unknown[]) => void) => (o?.all ? cb(null, [{ address: d.direccion, family: d.familia }]) : cb(null, d.direccion, d.familia)),
        headers: { ...cabeceras, 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(cuerpo)), 'user-agent': 'Capaz-Webhooks/1' },
        agent: false,
        timeout: tiempoMs,
      } as https.RequestOptions,
      (res) => {
        const codigo = res.statusCode ?? 0;
        res.resume();
        res.on('end', () => fin(resultadoDe(codigo)));
        res.on('error', () => fin({ ok: false, codigoHttp: codigo, error: 'respuesta_cortada' }));
      },
    );
    const limite = setTimeout(() => req.destroy(), tiempoMs + 500);
    limite.unref();
    req.on('timeout', () => {
      fin({ ok: false, codigoHttp: null, error: 'tiempo_agotado' });
      req.destroy();
    });
    req.on('error', () => fin({ ok: false, codigoHttp: null, error: 'error_de_red' }));
    req.on('close', () => {
      clearTimeout(limite);
      fin({ ok: false, codigoHttp: null, error: 'conexion_cerrada' });
    });
    req.end(cuerpo);
  });
}

function resultadoDe(codigo: number): ResultadoDeEnvio {
  if (codigo >= 200 && codigo < 300) return { ok: true, codigoHttp: codigo, error: null };
  if (codigo >= 300 && codigo < 400) return { ok: false, codigoHttp: codigo, error: 'redireccion_no_permitida' };
  return { ok: false, codigoHttp: codigo, error: `http_${codigo}` };
}
