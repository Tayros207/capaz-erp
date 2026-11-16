import { Module } from '@nestjs/common';
import { HerramientasDeInsumos } from './herramientas/herramientas-de-insumos.js';

/** Inventario: artículos bajo control, existencias por sucursal, entradas, salidas y ajustes. */
@Module({ providers: [HerramientasDeInsumos] })
export class InsumosModule {}
