import { Global, Module } from '@nestjs/common';
import { RegistroDeHerramientas } from './registro.js';

@Global()
@Module({
  providers: [RegistroDeHerramientas],
  exports: [RegistroDeHerramientas],
})
export class HerramientasModule {}
