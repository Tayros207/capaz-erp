import { Inject, Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  exito, rechazo, type ConversacionBorrada, type ConversacionConMensajes, type ConversacionDelAgente, type EstadoDelAgente, type ListaDeConversaciones, type Respuesta,
} from '@capaz/shared';
import { CONFIG, type Config } from '../../infra/config/config.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import type { ContextoDePeticion } from '../../infra/http/contexto.js';
import { escrituraEfectiva, modeloEfectivo, modoDeEscritura } from './modelos.js';
import { rechazoPrevio } from './reglas-de-entrada.js';
import { borrarConversacion, listarConversaciones, marcarFavorita, renombrar, verConversacion } from './repositorio.js';
import { gastoDelMes, leerConfiguracion, zonaDeLaEmpresa } from './repositorio-de-uso.js';

const NO_ENCONTRADA = 'No encontré esa conversación.';

/** Las operaciones REST sobre las conversaciones de cada persona y el estado del asistente. Todo dentro de `conEmpresa`. */
@Injectable()
export class ServicioDeConversaciones {
  constructor(
    @Inject(CONFIG) private readonly config: Config,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  private conTx<T>(ctx: ContextoDePeticion, fn: (tx: Transaccion) => Promise<T>): Promise<T> {
    if (!ctx.empresaId || !ctx.usuarioId) throw new Error('Esta operación exige empresa y persona.');
    return this.db.conEmpresa({ empresaId: ctx.empresaId, usuarioId: ctx.usuarioId }, fn);
  }

  /** Lo que el panel necesita para decidir qué mostrar. No revela nada de otras personas ni de otras empresas. */
  async estado(ctx: ContextoDePeticion): Promise<EstadoDelAgente> {
    const { fila, gasto } = await this.conTx(ctx, async (tx) => {
      const fila = await leerConfiguracion(tx);
      return { fila, gasto: await gastoDelMes(tx, new Date(), await zonaDeLaEmpresa(tx)) };
    });
    const previo = rechazoPrevio({ proveedor: this.config.AGENTE_PROVEEDOR, puedeEntrarAAlgunModulo: ctx.modulos.some((m) => m.puedeEntrar) });
    const tope = fila?.topeMensualMicrousd ?? Math.round(this.config.AGENTE_TOPE_MENSUAL_USD * 1_000_000);
    const motivo = previo?.motivo ?? (gasto >= tope ? ('tope_mensual' as const) : null);
    const modelo = modeloEfectivo(this.config, fila?.modelo ?? null);
    return {
      activo: motivo === null,
      motivo,
      modelo: this.config.AGENTE_PROVEEDOR === 'apagado' ? null : modelo,
      puedeConfigurar: ctx.permisos.includes('empresa:configurar'),
      escritura: modoDeEscritura(modelo, escrituraEfectiva(this.config, fila ?? null)),
    };
  }

  async listar(ctx: ContextoDePeticion, antesDe: string | undefined): Promise<Respuesta<ListaDeConversaciones>> {
    const fecha = antesDe ? new Date(antesDe) : undefined;
    return exito(await this.conTx(ctx, (tx) => listarConversaciones(tx, { antesDe: fecha, retencionDias: this.config.AGENTE_RETENCION_DIAS })));
  }

  async ver(ctx: ContextoDePeticion, id: string): Promise<Respuesta<ConversacionConMensajes>> {
    if (!z.uuid().safeParse(id).success) return rechazo('no_encontrado', NO_ENCONTRADA);
    const c = await this.conTx(ctx, (tx) => verConversacion(tx, id));
    return c ? exito(c) : rechazo('no_encontrado', NO_ENCONTRADA);
  }

  async renombrar(ctx: ContextoDePeticion, id: string, titulo: string): Promise<Respuesta<ConversacionDelAgente>> {
    if (!z.uuid().safeParse(id).success) return rechazo('no_encontrado', NO_ENCONTRADA);
    const c = await this.conTx(ctx, (tx) => renombrar(tx, id, titulo));
    return c ? exito(c) : rechazo('no_encontrado', NO_ENCONTRADA);
  }

  async favorita(ctx: ContextoDePeticion, id: string, favorita: boolean): Promise<Respuesta<ConversacionDelAgente>> {
    if (!z.uuid().safeParse(id).success) return rechazo('no_encontrado', NO_ENCONTRADA);
    const c = await this.conTx(ctx, (tx) => marcarFavorita(tx, id, favorita));
    return c ? exito(c) : rechazo('no_encontrado', NO_ENCONTRADA);
  }

  async borrar(ctx: ContextoDePeticion, id: string): Promise<Respuesta<ConversacionBorrada>> {
    if (!z.uuid().safeParse(id).success) return rechazo('no_encontrado', NO_ENCONTRADA);
    const borrada = await this.conTx(ctx, (tx) => borrarConversacion(tx, id));
    return borrada ? exito({ id }) : rechazo('no_encontrado', NO_ENCONTRADA);
  }
}
