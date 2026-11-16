import { Module } from '@nestjs/common';
import { HerramientasDeOrdenes } from './herramientas/herramientas-de-ordenes.js';

@Module({ providers: [HerramientasDeOrdenes] })
export class OrdenesModule {}
