import { Module } from '@nestjs/common';
import { HerramientasDeComposicion } from './herramientas-de-composicion.js';

@Module({ providers: [HerramientasDeComposicion] })
export class ComposicionModule {}
