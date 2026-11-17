import { Module } from '@nestjs/common';
import { HerramientasDeProduccion } from './herramientas/herramientas-de-produccion.js';

@Module({ providers: [HerramientasDeProduccion] })
export class ProduccionModule {}
