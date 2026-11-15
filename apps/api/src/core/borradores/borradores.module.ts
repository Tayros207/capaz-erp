import { Module } from '@nestjs/common';
import { HerramientasDeBorradores } from './herramientas-de-borradores.js';

@Module({ providers: [HerramientasDeBorradores] })
export class BorradoresModule {}
