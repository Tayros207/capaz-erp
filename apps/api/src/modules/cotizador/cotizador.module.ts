import { Module } from '@nestjs/common';
import { EnlacesPublicos } from './publico/enlaces-publicos.servicio.js';
import { EnlacesPublicosController } from './publico/enlaces-publicos.controller.js';
import { HerramientasDeCotizador } from './herramientas/herramientas-de-cotizador.js';

/** Lista de precios por cantidad, ajustes por cliente, configuración y cotizaciones (B1) y el enlace público del cliente (B3). */
@Module({ controllers: [EnlacesPublicosController], providers: [HerramientasDeCotizador, EnlacesPublicos] })
export class CotizadorModule {}
