import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeConsumidores } from '../../../core/eventos/registro-de-consumidores.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { CONSUMIDORES_DE_ORDENES } from '../consumidores.js';
import { entregaVence } from '../fuentes.js';
import { pedidoAnotar, pedidoCrear, pedidoEditar } from './pedidos-escritura.js';
import { pedidoCambiarEstado, pedidoCancelar, pedidoConfirmar } from './pedidos-estado.js';
import { pedidosPreciosAnteriores } from './pedidos-precios-anteriores.js';
import { ordenesPendientes } from './pedidos-pendientes.js';
import { ordenesResumen, pedidoVer, pedidosListar } from './pedidos-lectura.js';

/** Las herramientas, la fuente de tiempo del módulo de pedidos. y los consumidores del puente cotización → pedido. */
@Injectable()
export class HerramientasDeOrdenes implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
  ) {}

  onModuleInit(): void {
    this.registro.agregar([pedidoCrear, pedidoEditar, pedidoVer, pedidosListar, pedidoAnotar, pedidoConfirmar, pedidoCambiarEstado, pedidoCancelar, ordenesResumen, pedidosPreciosAnteriores, ordenesPendientes]);
    this.consumidores.agregar(CONSUMIDORES_DE_ORDENES);
    this.fuentes.agregar([entregaVence]);
  }
}
