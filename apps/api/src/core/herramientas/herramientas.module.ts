import { Global, Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { EjecutorDeHerramientas } from './ejecutor.js';
import { HerramientasController } from './herramientas.controller.js';
import { RegistroDeHerramientas } from './registro.js';

@Global()
@Module({
  imports: [AuditoriaModule],
  controllers: [HerramientasController],
  providers: [RegistroDeHerramientas, EjecutorDeHerramientas],
  exports: [RegistroDeHerramientas, EjecutorDeHerramientas],
})
export class HerramientasModule {}
