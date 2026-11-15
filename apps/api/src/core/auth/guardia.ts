import { CanActivate, Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import { DatabaseService } from '../../infra/database/database.service.js';
import { contextoActual } from '../../infra/http/contexto.js';
import { ErrorDeNegocio } from '../../infra/http/error-de-negocio.js';
import { EmpresasService } from '../empresas/empresas.service.js';
import type { Asignacion, Contratacion } from '../modulos/acceso.js';
import { CatalogoDeModulos } from '../modulos/catalogo.js';
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
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(EmpresasService) private readonly empresas: EmpresasService,
    @Inject(CatalogoDeModulos) private readonly catalogo: CatalogoDeModulos,
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
      const { rows } = await this.db.auth.query<{ role: string }>(
        'select role from auth.member where user_id = $1 and organization_id = $2',
        [sesion.user.id, activa],
      );
      if (rows[0]) {
        ctx.empresaId = activa;
        ctx.rol = rows[0].role;
        await this.empresas.asegurar(activa, sesion.user.id);
        await this.cargarAcceso(ctx, sesion.user.id, activa);
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

  /** Contratación de la empresa y asignaciones de la persona, en UNA transacción (una ida y vuelta a la base). */
  private async cargarAcceso(ctx: NonNullable<ReturnType<typeof contextoActual>>, usuarioId: string, empresaId: string): Promise<void> {
    const { contratos, asignaciones } = await this.db.conEmpresa({ empresaId, usuarioId }, async (tx) => {
      // Drizzle devuelve las fechas de consultas crudas como texto: se convierten a Date.
      const c = await tx.execute<{ modulo: string; estado: Contratacion['estado']; prueba_hasta: string | Date | null }>(
        sql`select modulo, estado, prueba_hasta from core.empresa_modulos`,
      );
      const a = await tx.execute<{ modulo: string; nivel: Asignacion['nivel']; alcance: Asignacion['alcance'] }>(
        sql`select modulo, nivel, alcance from core.usuario_modulos where usuario_id = ${usuarioId}`,
      );
      return {
        contratos: c.rows.map((r): Contratacion => ({ modulo: r.modulo, estado: r.estado, pruebaHasta: r.prueba_hasta ? new Date(r.prueba_hasta) : null })),
        asignaciones: a.rows.map((r): Asignacion => ({ modulo: r.modulo, nivel: r.nivel, alcance: r.alcance })),
      };
    });
    ctx.modulos = this.catalogo.accesos({ rol: ctx.rol, contratos, asignaciones });
    ctx.permisos = this.catalogo.permisos(ctx.modulos);
  }
}
