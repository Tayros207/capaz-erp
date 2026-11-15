import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { clientesArchivar, clientesCrear, clientesEditar, clientesRestaurar } from './clientes-escritura.js';
import { clientesBuscar, clientesListar, clientesVer } from './clientes-lectura.js';

/** Las herramientas de clientes y proveedores. */
@Injectable()
export class HerramientasDeClientes implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([clientesListar, clientesVer, clientesBuscar, clientesCrear, clientesEditar, clientesArchivar, clientesRestaurar]);
  }
}
