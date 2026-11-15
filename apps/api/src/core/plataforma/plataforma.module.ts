import { Module } from '@nestjs/common';
import { EjecutorDePlataforma } from './ejecutor-de-plataforma.js';
import { GuardiaDePlataforma } from './guardia-de-plataforma.js';
import { HerramientasDePlataforma } from './herramientas-de-plataforma.js';
import { PlataformaController } from './plataforma.controller.js';
import { RegistroDePlataforma } from './registro-de-plataforma.js';

/** Consola de plataforma (servidor): lista blanca de operadores, registro y ejecutor propios, rol `sistema`. */
@Module({
  controllers: [PlataformaController],
  providers: [RegistroDePlataforma, EjecutorDePlataforma, GuardiaDePlataforma, HerramientasDePlataforma],
  exports: [RegistroDePlataforma, EjecutorDePlataforma],
})
export class PlataformaModule {}
