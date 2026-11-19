import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { FUENTES_DE_CRM } from '../fuentes.js';
import { actividadCompletar, actividadCrear } from './actividades-escritura.js';
import { oportunidadGanar, oportunidadPerder, oportunidadReabrir } from './cierre.js';
import { crmIniciar, etapaArchivar, etapaCrear, etapaEditar, etapasOrdenar } from './etapas-escritura.js';
import { etapasListar, oportunidadesListar, oportunidadVer } from './lectura.js';
import { oportunidadCrear, oportunidadEditar, oportunidadMover } from './oportunidades-escritura.js';
import { actividadesListar, crmResumen } from './seguimiento-lectura.js';
import { crmPendientes } from './actividades-pendientes.js';

/** Herramientas y fuentes de tiempo de `crm` (R1). El módulo no consume eventos en esta ola (§5.3). */
@Injectable()
export class HerramientasDeCrm implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly herramientas: RegistroDeHerramientas,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
  ) {}

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
      oportunidadGanar,
      oportunidadPerder,
      oportunidadReabrir,
      actividadCrear,
      actividadCompletar,
      actividadesListar,
      crmResumen,
      crmPendientes,
    ]);
    this.fuentes.agregar(FUENTES_DE_CRM);
  }
}
