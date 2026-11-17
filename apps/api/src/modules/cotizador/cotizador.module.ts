import { Module } from '@nestjs/common';
import { HerramientasDeCotizador } from './herramientas/herramientas-de-cotizador.js';

/** Lista de precios por cantidad, ajustes por cliente, configuración y cotizaciones (B1). */
@Module({ providers: [HerramientasDeCotizador] })
export class CotizadorModule {}
