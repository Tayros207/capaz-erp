import { Global, Module } from '@nestjs/common';
import { CONFIG } from '../../infra/config/config.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { HerramientasDeCaptura } from './herramientas-de-captura.js';
import { MODELO_DE_LENGUAJE } from './modelo-de-lenguaje.js';
import { crearModeloDeLenguaje } from './modelo-de-lenguaje-openrouter.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';

@Global()
@Module({
  // Sin `AGENTE_PROVEEDOR=openrouter` queda `ModeloNulo`: solo reglas, sin red.
  providers: [RegistroDeInterpretes, { provide: MODELO_DE_LENGUAJE, inject: [CONFIG, LOGGER], useFactory: crearModeloDeLenguaje }, HerramientasDeCaptura],
  exports: [RegistroDeInterpretes],
})
export class CapturaModule {}
