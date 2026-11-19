import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { ordenAnular, ordenCobrar, ordenCrear, ordenEditar, ordenEstado } from './ordenes-escritura.js';
import { ordenesListar, ordenVer } from './ordenes-lectura.js';
import { ordenesPreciosAnteriores } from './precios-anteriores.js';
import { produccionPendientes } from './ordenes-pendientes.js';

export const HERRAMIENTAS_DE_PRODUCCION = [ordenesListar, ordenVer, ordenCrear, ordenEditar, ordenEstado, ordenCobrar, ordenAnular, ordenesPreciosAnteriores, produccionPendientes] as const;

/** Las herramientas del módulo de producción. No consume eventos: los emite para Finanzas. */
@Injectable()
export class HerramientasDeProduccion implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([...HERRAMIENTAS_DE_PRODUCCION]);
  }
}
