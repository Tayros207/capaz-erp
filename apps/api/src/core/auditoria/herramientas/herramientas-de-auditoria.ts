import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { auditoriaListar } from './auditoria-listar.js';

@Injectable()
export class HerramientasDeAuditoria implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([auditoriaListar]);
  }
}
