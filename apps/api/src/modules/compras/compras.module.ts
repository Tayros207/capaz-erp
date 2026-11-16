import { Module } from '@nestjs/common';
import { HerramientasDeCompras } from './herramientas/herramientas-de-compras.js';

@Module({ providers: [HerramientasDeCompras] })
export class ComprasModule {}
