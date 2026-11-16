import { Global, Module } from '@nestjs/common';
import { HerramientasDeCaptura } from './herramientas-de-captura.js';
import { MODELO_DE_LENGUAJE, ModeloNulo } from './modelo-de-lenguaje.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';

@Global()
@Module({
  providers: [RegistroDeInterpretes, { provide: MODELO_DE_LENGUAJE, useClass: ModeloNulo }, HerramientasDeCaptura],
  exports: [RegistroDeInterpretes],
})
export class CapturaModule {}
