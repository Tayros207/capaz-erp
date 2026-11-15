import { Module } from '@nestjs/common';
import { HerramientasDeSucursales } from './herramientas/herramientas-de-sucursales.js';

@Module({ providers: [HerramientasDeSucursales] })
export class SucursalesModule {}
