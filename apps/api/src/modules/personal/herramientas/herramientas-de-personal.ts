import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { adelantoAnular, adelantoRegistrar, adelantosListar } from './adelantos-herramientas.js';
import { asistenciaCorregir, asistenciaMarcar, asistenciasListar } from './asistencias-herramientas.js';
import { colaboradorArchivar, colaboradorCrear, colaboradorEditar, colaboradorRestaurar } from './colaboradores-escritura.js';
import { colaboradorVer, colaboradoresListar } from './colaboradores-lectura.js';
import { personalResumen } from './resumen-herramienta.js';

/** Las herramientas del módulo de personal. No consume eventos ni tiene fuentes de tiempo en esta ola. */
@Injectable()
export class HerramientasDePersonal implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([
      colaboradorCrear, colaboradorEditar, colaboradorArchivar, colaboradorRestaurar, colaboradoresListar, colaboradorVer,
      asistenciaMarcar, asistenciaCorregir, asistenciasListar,
      adelantoRegistrar, adelantoAnular, adelantosListar,
      personalResumen,
    ]);
  }
}
