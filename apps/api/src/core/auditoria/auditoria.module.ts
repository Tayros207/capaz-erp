import { Module } from '@nestjs/common';
import { EscritorDeAuditoria } from './escritor.js';
import { HerramientasDeAuditoria } from './herramientas/herramientas-de-auditoria.js';

@Module({
  providers: [EscritorDeAuditoria, HerramientasDeAuditoria],
  exports: [EscritorDeAuditoria],
})
export class AuditoriaModule {}
