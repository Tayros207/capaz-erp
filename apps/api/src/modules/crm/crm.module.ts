import { Module } from '@nestjs/common';
import { HerramientasDeCrm } from './herramientas/herramientas-de-crm.js';

@Module({ providers: [HerramientasDeCrm] })
export class CrmModule {}
