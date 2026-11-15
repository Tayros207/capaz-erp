import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { RegistroDeHerramientas } from '../../herramientas/registro.js';
import { ServicioDeMiembros } from '../miembros.service.js';
import { crearInvitacionAnular } from './invitacion-anular.js';
import { crearInvitacionCrear } from './invitacion-crear.js';
import { crearInvitacionesListar } from './invitaciones-listar.js';
import { crearMiembroAsignarModulo } from './miembro-asignar-modulo.js';
import { crearMiembroCambiarRol } from './miembro-cambiar-rol.js';
import { crearMiembroQuitar } from './miembro-quitar.js';
import { crearMiembrosListar } from './miembros-listar.js';

/** Las herramientas de personas, roles, módulos asignados e invitaciones. */
@Injectable()
export class HerramientasDeMiembros implements OnModuleInit {
  constructor(
    @Inject(RegistroDeHerramientas) private readonly registro: RegistroDeHerramientas,
    @Inject(ServicioDeMiembros) private readonly servicio: ServicioDeMiembros,
  ) {}

  onModuleInit(): void {
    this.registro.agregar([
      crearMiembrosListar(this.servicio),
      crearMiembroAsignarModulo(this.servicio),
      crearMiembroCambiarRol(this.servicio),
      crearMiembroQuitar(this.servicio),
      crearInvitacionCrear(this.servicio),
      crearInvitacionAnular(this.servicio),
      crearInvitacionesListar(this.servicio),
    ]);
  }
}
