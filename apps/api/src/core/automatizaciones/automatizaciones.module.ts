import { Global, Module } from '@nestjs/common';
import { DisparadoresDeReglas } from './disparadores.js';
import { HerramientasDeAutomatizaciones } from './herramientas-de-automatizaciones.js';
import { MotorDeReglas } from './motor.js';
import { RegistroDeFuentesDeTiempo } from './tipos.js';

/** Global: los módulos declaran sus fuentes de tiempo inyectando `RegistroDeFuentesDeTiempo` en `onModuleInit`. */
@Global()
@Module({
  providers: [RegistroDeFuentesDeTiempo, MotorDeReglas, DisparadoresDeReglas, HerramientasDeAutomatizaciones],
  exports: [RegistroDeFuentesDeTiempo],
})
export class AutomatizacionesModule {}
