import { randomUUID } from 'node:crypto';
import { pinoHttp } from 'pino-http';
import type { Logger } from 'pino';
import { contextoActual } from '../http/contexto.js';

/**
 * Un registro por petición con `requestId`, empresa, usuario, ruta, estado y duración.
 * Va DESPUÉS del middleware de contexto. Los campos de empresa y usuario los llena el guardia de
 * identidad; se leen al terminar la petición, por eso salen completos.
 */
export function crearRegistroHttp(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: () => contextoActual()?.requestId ?? randomUUID(),
    customProps: () => {
      const c = contextoActual();
      return { requestId: c?.requestId, empresaId: c?.empresaId, usuarioId: c?.usuarioId };
    },
    customLogLevel: (_req, res, error) => (error || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
    // Solo lo mínimo: método y ruta SIN la query (puede llevar tokens). Nada de cabeceras ni cuerpos.
    serializers: {
      req: (req: { id: unknown; method: string; url: string }) => ({
        id: req.id,
        method: req.method,
        url: req.url.split('?')[0],
      }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  });
}
