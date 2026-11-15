import { Module } from '@nestjs/common';
import { HerramientasDeProductos } from './herramientas/herramientas-de-productos.js';

@Module({ providers: [HerramientasDeProductos] })
export class ProductosModule {}
