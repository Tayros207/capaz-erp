import type { NestExpressApplication } from '@nestjs/platform-express';
import { toNodeHandler } from 'better-auth/node';
import { rechazo } from '@capaz/shared';
import type { Logger } from 'pino';
import { AUTH, type Auth } from './core/auth/auth.js';
import { esCuerpoDeAudio, LIMITE_DEL_CUERPO_DE_AUDIO } from './core/agente/cuerpo-de-audio.js';
import { rutaDeAutenticacionPermitida } from './core/auth/rutas-permitidas.js';
import { middlewareDeContexto } from './infra/http/contexto.js';
import { MENSAJES } from './infra/http/error-de-negocio.js';
import { crearPipeDeValidacion } from './infra/http/validacion.js';
import { crearRegistroHttp } from './infra/logger/http-logger.js';

const BASE_AUTH = '/api/auth';

/**
 * Montaje común del servidor (lo usan `main.ts` y las pruebas de integración). El orden importa:
 * contexto → registro → rutas de Better Auth (ANTES de los analizadores de cuerpo) → analizador
 * JSON → resto. La aplicación debe crearse con `bodyParser: false`.
 */
export function configurarApp(app: NestExpressApplication, logger: Logger): void {
  app.setGlobalPrefix('api');
  app.use(middlewareDeContexto);
  app.use(crearRegistroHttp(logger));

  const manejadorDeAuth = toNodeHandler(app.get<Auth>(AUTH));
  app.getHttpAdapter().getInstance().all(`${BASE_AUTH}/*splat`, (req: import('express').Request, res: import('express').Response) => {
    if (!rutaDeAutenticacionPermitida(req.method, req.path.slice(BASE_AUTH.length))) {
      res.status(404).json(rechazo('no_encontrado', MENSAJES.no_encontrado));
      return;
    }
    return manejadorDeAuth(req, res);
  });

  // El dictado por audio es la única ruta con cuerpo grande: su analizador va primero y solo lee esa ruta; el general ve el cuerpo ya
  // leído y lo salta. Todo lo demás sigue con 256 kB.
  app.useBodyParser('json', { limit: LIMITE_DEL_CUERPO_DE_AUDIO, type: esCuerpoDeAudio });
  app.useBodyParser('json', { limit: '256kb' });
  app.useGlobalPipes(crearPipeDeValidacion());
  app.enableShutdownHooks();
}
