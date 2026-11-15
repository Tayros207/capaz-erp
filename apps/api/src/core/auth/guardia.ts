import { CanActivate, Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { contextoActual } from '../../infra/http/contexto.js';
import { ErrorDeNegocio } from '../../infra/http/error-de-negocio.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { AUTH, type Auth } from './auth.js';
import { ES_PUBLICA, EXIGE_EMPRESA, MODULO_REQUERIDO, PERMISO_REQUERIDO } from '../../infra/http/decoradores.js';

/**
 * Guardia global de identidad. Sin sesión, `no_autenticado`. Con sesión llena el contexto de la
 * petición desde la SESIÓN del servidor (nunca desde la petición) y, en cada petición, comprueba que
 * el usuario SIGUE siendo miembro de su empresa activa: un miembro expulsado pierde el acceso en la
 * siguiente petición aunque su sesión (o su caché de cookie de 5 minutos) siga viva.
 */
@Injectable()
export class GuardiaDeIdentidad implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(AUTH) private readonly auth: Auth,
    @Inject(EmpresasService) private readonly empresas: EmpresasService,
    @Inject(ServicioDeAcceso) private readonly acceso: ServicioDeAcceso,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const objetivos = [contexto.getHandler(), contexto.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ES_PUBLICA, objetivos)) return true;

    const req = contexto.switchToHttp().getRequest<Request>();
    const sesion = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!sesion) throw new ErrorDeNegocio('no_autenticado');

    const ctx = contextoActual();
    if (!ctx) throw new ErrorDeNegocio('error_interno');
    ctx.usuarioId = sesion.user.id;
    ctx.canal = 'ui';

    const activa = sesion.session.activeOrganizationId;
    if (activa) {
      const rol = await this.acceso.rolDe(activa, sesion.user.id);
      if (rol !== null) {
        ctx.empresaId = activa;
        ctx.rol = rol;
        await this.empresas.asegurar(activa, sesion.user.id);
        const { modulos, permisos } = await this.acceso.cargarAcceso(rol, activa, sesion.user.id);
        ctx.modulos = modulos;
        ctx.permisos = permisos;
      }
    }
    const modulo = this.reflector.getAllAndOverride<string | undefined>(MODULO_REQUERIDO, objetivos);
    const permiso = this.reflector.getAllAndOverride<string | undefined>(PERMISO_REQUERIDO, objetivos);
    const exige = this.reflector.getAllAndOverride<boolean>(EXIGE_EMPRESA, objetivos) || !!modulo || !!permiso;
    if (exige && !ctx.empresaId) throw new ErrorDeNegocio('sin_empresa');
    if (modulo && !ctx.modulos.find((m) => m.codigo === modulo)?.puedeEntrar) throw new ErrorDeNegocio('modulo_no_disponible');
    if (permiso && !ctx.permisos.includes(permiso)) throw new ErrorDeNegocio('sin_permiso');
    return true;
  }
}
