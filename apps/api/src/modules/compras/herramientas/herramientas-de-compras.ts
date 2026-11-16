import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { RegistroDeHerramientas } from '../../../core/herramientas/registro.js';
import { entregaVence } from '../fuentes.js';
import { compraCrear, compraEditar } from './compras-escritura.js';
import { compraCancelar, compraEnviar } from './compras-estado.js';
import { compraVer, comprasListar, comprasResumen } from './compras-lectura.js';
import { compraRecibir } from './compras-recepcion.js';

/** Las herramientas y la fuente de tiempo de compras. El módulo no consume eventos: los emite para Inventario y Finanzas. */
@Injectable()
export class HerramientasDeCompras implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
  ) {}

  onModuleInit(): void {
    this.registro.agregar([compraCrear, compraEditar, compraVer, comprasListar, compraEnviar, compraRecibir, compraCancelar, comprasResumen]);
    this.fuentes.agregar([entregaVence]);
  }
}
