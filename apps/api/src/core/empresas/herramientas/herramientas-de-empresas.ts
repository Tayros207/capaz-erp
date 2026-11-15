import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { CatalogoDeModulos } from '../../modulos/catalogo.js';
import { empresaActualizarConfiguracion } from './empresa-actualizar-configuracion.js';
import { empresaVerConfiguracion } from './empresa-ver-configuracion.js';
import { crearModuloSolicitar } from './modulo-solicitar.js';

/** Las herramientas de la empresa y de la contratación de módulos. */
@Injectable()
export class HerramientasDeEmpresas implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
  ) {}

  onModuleInit(): void {
    this.registro.agregar([
      empresaVerConfiguracion,
      empresaActualizarConfiguracion,
      crearModuloSolicitar(this.catalogo),
    ]);
  }
}
