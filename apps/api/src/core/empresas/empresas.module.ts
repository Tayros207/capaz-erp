import { Module } from '@nestjs/common';
import { EmpresasController } from './empresas.controller.js';
import { EmpresasService } from './empresas.service.js';
import { HerramientasDeEmpresas } from './herramientas/herramientas-de-empresas.js';

@Module({
  controllers: [EmpresasController],
  providers: [EmpresasService, HerramientasDeEmpresas],
  exports: [EmpresasService],
})
export class EmpresasModule {}
