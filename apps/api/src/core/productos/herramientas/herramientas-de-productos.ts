import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { productosArchivar, productosCrear, productosEditar, productosRestaurar } from './productos-escritura.js';
import { HERRAMIENTAS_DE_PRODUCTOS_AMPLIADOS } from './productos-ampliados.js';
import { productosBuscar, productosListar, productosVer } from './productos-lectura.js';

/** Las herramientas del catálogo de productos y servicios. */
@Injectable()
export class HerramientasDeProductos implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([productosListar, productosVer, productosBuscar, productosCrear, productosEditar, productosArchivar, productosRestaurar, ...HERRAMIENTAS_DE_PRODUCTOS_AMPLIADOS]);
  }
}
