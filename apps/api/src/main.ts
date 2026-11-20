import './infra/config/load-env.js';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';
import { ConfigInvalida, leerConfigDelEntorno } from './infra/config/config.js';
import { LoggerDeNest, crearLogger } from './infra/logger/logger.js';

async function bootstrap() {
  let config;
  try {
    config = leerConfigDelEntorno();
  } catch (e) {
    if (e instanceof ConfigInvalida) {
      console.error(e.message);
      process.exit(1);
    }
    throw e;
  }
  const logger = crearLogger(config.NODE_ENV);

  // bodyParser desactivado: Better Auth se monta antes de los analizadores de cuerpo (configurarApp).
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: new LoggerDeNest(logger) });
  configurarApp(app, logger);
  console.error('DIAG', JSON.stringify(Object.fromEntries(Object.entries(process.env).filter(([k]) => /PORT|HOST|VERCEL|SOCK|LAMBDA/i.test(k) && !/SECRET|KEY|TOKEN|URL_/i.test(k)))));
  await app.listen(config.PORT, '0.0.0.0');
  logger.info({ puerto: config.PORT }, 'Servidor escuchando');
}
await bootstrap();
