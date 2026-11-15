import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { sucursalArchivar, sucursalCrear, sucursalEditar, sucursalMarcarPrincipal, sucursalesListar } from './sucursales-herramientas.js';

/** Las herramientas de las sucursales. */
@Injectable()
export class HerramientasDeSucursales implements OnModuleInit {
  constructor(@Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas) {}

  onModuleInit(): void {
    this.registro.agregar([sucursalesListar, sucursalCrear, sucursalEditar, sucursalArchivar, sucursalMarcarPrincipal]);
  }
}
