import { Global, Module } from '@nestjs/common';
import { CONFIG, leerConfigDelEntorno } from './config.js';

@Global()
@Module({
  providers: [{ provide: CONFIG, useFactory: leerConfigDelEntorno }],
  exports: [CONFIG],
})
export class ConfigModule {}
