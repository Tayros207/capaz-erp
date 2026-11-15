import { Global, Module } from '@nestjs/common';
import { CONFIG, type Config } from '../config/config.js';
import { LOGGER, crearLogger } from './logger.js';

@Global()
@Module({
  providers: [{ provide: LOGGER, useFactory: (c: Config) => crearLogger(c.NODE_ENV), inject: [CONFIG] }],
  exports: [LOGGER],
})
export class LoggerModule {}
