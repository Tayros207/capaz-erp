import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { crmIniciar, etapaArchivar, etapaCrear, etapaEditar, etapasOrdenar } from './etapas-escritura.js';
import { etapasListar, oportunidadesListar, oportunidadVer } from './lectura.js';
import { oportunidadCrear, oportunidadEditar, oportunidadMover } from './oportunidades-escritura.js';

/** Herramientas, consumidores y fuentes de tiempo de `crm` (R1). */
@Injectable()
export class HerramientasDeCrm implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.herramientas.agregar([
      crmIniciar,
      etapasListar,
      etapaCrear,
      etapaEditar,
      etapasOrdenar,
      etapaArchivar,
      oportunidadCrear,
      oportunidadVer,
      oportunidadesListar,
      oportunidadEditar,
      oportunidadMover,
    ]);
  }
}
