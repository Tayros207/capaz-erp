import { Global, Module } from '@nestjs/common';
import { Mantenimiento } from './mantenimiento.js';
import { RegistroDeConsumidores } from './registro-de-consumidores.js';
import { RegistroDeTareas } from './registro-de-tareas.js';
import { Relevo } from './relevo.js';

@Global()
@Module({
  providers: [RegistroDeConsumidores, RegistroDeTareas, Mantenimiento, Relevo],
  exports: [RegistroDeConsumidores, RegistroDeTareas, Relevo],
})
export class EventosModule {}
