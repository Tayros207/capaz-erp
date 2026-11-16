import { Module } from '@nestjs/common';
import { HerramientasDeReportes } from './herramientas/herramientas-de-reportes.js';

@Module({ providers: [HerramientasDeReportes] })
export class ReportesModule {}
