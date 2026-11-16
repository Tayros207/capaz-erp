import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { entregaVence } from '../fuentes.js';
import { pedidoAnotar, pedidoCrear, pedidoEditar } from './pedidos-escritura.js';
import { pedidoCambiarEstado, pedidoCancelar, pedidoConfirmar } from './pedidos-estado.js';
import { ordenesResumen, pedidoVer, pedidosListar } from './pedidos-lectura.js';

/** Las herramientas y la fuente de tiempo del módulo de pedidos. El módulo no consume eventos en esta ola. */
@Injectable()
export class HerramientasDeOrdenes implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
  ) {}

  onModuleInit(): void {
    this.registro.agregar([pedidoCrear, pedidoEditar, pedidoVer, pedidosListar, pedidoAnotar, pedidoConfirmar, pedidoCambiarEstado, pedidoCancelar, ordenesResumen]);
    this.fuentes.agregar([entregaVence]);
  }
}
