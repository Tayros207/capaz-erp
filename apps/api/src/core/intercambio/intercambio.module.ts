import { Module } from '@nestjs/common';
import { AuditoriaModule } from '../auditoria/auditoria.module.js';
import { HerramientasDeIntercambio } from './herramientas-de-intercambio.js';

@Module({ imports: [AuditoriaModule], providers: [HerramientasDeIntercambio] })
export class IntercambioModule {}
