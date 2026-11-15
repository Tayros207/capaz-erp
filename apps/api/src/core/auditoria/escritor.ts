import { Inject, Injectable } from '@nestjs/common';
import { auditoria } from '../../db/esquema/core-herramientas.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../herramientas/tipos.js';

export type ResultadoDeAuditoria = 'ok' | 'rechazada' | 'pendiente_confirmacion';

/** Una operación de negocio, salga como salga. Nunca lleva argumentos en claro: solo su hash. */
export type EventoParaAuditar = {
  ctx: ContextoDeHerramienta;
  modulo: string;
  herramienta: string;
  resultado: ResultadoDeAuditoria;
  codigo: string | null;
  hashArgs: string;
  /** Solo lo que la herramienta declaró como seguro (`auditar`). */
  datos?: DatosDeAuditoria;
  duracionMs: number;
};

const LARGO_MAXIMO = 100;

/**
 * Único escritor de `core.auditoria` (solo inserción: un disparador impide `update` y `delete`).
 * El éxito se escribe en la transacción de la operación; un rechazo, en una transacción propia,
 * porque la de la operación se revierte entera.
 */
@Injectable()
export class EscritorDeAuditoria {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async registrar(tx: Transaccion, e: EventoParaAuditar): Promise<void> {
    await tx.insert(auditoria).values({
      tenantId: e.ctx.empresaId,
      usuarioId: e.ctx.usuarioId,
      modulo: e.modulo.slice(0, LARGO_MAXIMO),
      herramienta: e.herramienta.slice(0, LARGO_MAXIMO),
      canal: e.ctx.canal,
      resultado: e.resultado,
      codigo: e.codigo,
      hashArgs: e.hashArgs,
      entidadTipo: e.datos?.entidadTipo ?? null,
      entidadId: e.datos?.entidadId ?? null,
      resumen: e.datos?.resumen ?? {},
      requestId: e.ctx.requestId,
      duracionMs: Math.max(0, Math.round(e.duracionMs)),
    });
  }

  /** En su propia transacción (`conEmpresa` abre una nueva si nadie la tiene abierta). */
  registrarAparte(e: EventoParaAuditar): Promise<void> {
    return this.db.conEmpresa({ empresaId: e.ctx.empresaId, usuarioId: e.ctx.usuarioId }, (tx) =>
      this.registrar(tx, e),
    );
  }
}
