import { Module } from '@nestjs/common';
import { HerramientasDePersonal } from './herramientas/herramientas-de-personal.js';

@Module({ providers: [HerramientasDePersonal] })
export class PersonalModule {}
