import { CanActivate, Inject, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Logger } from 'pino';
import { DatabaseService } from '../../infra/database/database.service.js';
import { contextoActual } from '../../infra/http/contexto.js';
import { ErrorDeNegocio } from '../../infra/http/error-de-negocio.js';
import { LOGGER } from '../../infra/logger/logger.js';

/**
 * Guardia propia de la consola (se aplica en su controlador; la global ya identificó la sesión).
 * Lista blanca: solo entra quien está en `core.plataforma_admins`. Se consulta en CADA petición:
 * quitar a una persona de la lista le corta el acceso al instante. Sin ser operador, `sin_permiso`.
 * El rechazo no se escribe en la tabla de auditoría (cualquier cuenta podría llenarla): va al registro.
 */
@Injectable()
export class GuardiaDePlataforma implements CanActivate {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const ctx = contextoActual();
    if (!ctx?.usuarioId) throw new ErrorDeNegocio('no_autenticado');
    const { rowCount } = await this.db.sistema.query('select 1 from core.plataforma_admins where usuario_id = $1', [ctx.usuarioId]);
    if (!rowCount) {
      const req = contexto.switchToHttp().getRequest<Request>();
      this.logger.warn({ requestId: ctx.requestId, ruta: req.path }, 'Acceso a la consola de plataforma sin ser operador');
      throw new ErrorDeNegocio('sin_permiso');
    }
    return true;
  }
}
