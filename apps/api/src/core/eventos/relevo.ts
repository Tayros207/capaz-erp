import { Inject, Injectable, Optional, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import type { TipoDeEvento } from '@capaz/shared';
import { sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import { CONFIG, type Config } from '../../infra/config/config.js';
import { DatabaseService } from '../../infra/database/database.service.js';
import { LOGGER } from '../../infra/logger/logger.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { CANAL_DE_EVENTOS } from './emisor.js';
import { RELOJ, type Reloj } from './reloj.js';
import { RegistroDeConsumidores } from './registro-de-consumidores.js';
import { RegistroDeTareas } from './registro-de-tareas.js';
import type { Consumidor } from './tipos.js';

export const MAX_INTENTOS = 8;
const TAMANO_DE_LOTE = 50;
const RESERVA_SEGUNDOS = 300;
const ESPERA_BASE_SEGUNDOS = 30;
const ESPERA_MAXIMA_SEGUNDOS = 3600;

type ClienteDeEscucha = {
  on: (evento: 'notification' | 'error', f: (...args: any[]) => void) => unknown;
  query: (consulta: string) => Promise<unknown>;
  release: (destruir?: boolean) => void;
};
type Reservado = { id: string; tenant_id: string; tipo: string; intentos: number };
export type ResultadoDeLote = { reservados: number; entregados: number; reintentos: number; fallidos: number };

/** Espera antes del reintento número `intento` (1, 2, …): 30 s, 1 min, 2 min… con tope de 1 h. */
export const esperaDeReintento = (intento: number): number =>
  Math.min(ESPERA_BASE_SEGUNDOS * 2 ** Math.max(0, intento - 1), ESPERA_MAXIMA_SEGUNDOS);

/**
 * Relevo de eventos, en el mismo proceso. Reserva lotes con el grupo `sistema` (solo ve metadatos,
 * nunca la `carga`) y entrega dentro de `conEmpresa` con el grupo de la aplicación (RLS).
 */
@Injectable()
export class Relevo implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly reloj: Reloj;
  private detenido = false;
  private escucha: ClienteDeEscucha | null = null;
  private temporizadorDeBarrido: NodeJS.Timeout | null = null;
  private readonly temporizadoresDeTareas: NodeJS.Timeout[] = [];
  private drenando: Promise<void> | null = null;
  private pidieronOtraVuelta = false;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ServicioDeAcceso) private readonly acceso: ServicioDeAcceso,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
    @Inject(RegistroDeTareas) private readonly tareas: RegistroDeTareas,
    @Inject(CONFIG) private readonly config: Pick<Config, 'RELEVO_ACTIVO' | 'RELEVO_BARRIDO_SEGUNDOS'>,
    @Inject(LOGGER) private readonly logger: Logger,
    @Optional() @Inject(RELOJ) reloj?: Reloj,
  ) {
    this.reloj = reloj ?? (() => new Date());
  }

  // ---- Ciclo de vida -------------------------------------------------------------------------

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.RELEVO_ACTIVO) return;
    this.iniciarTareas();
    await this.escuchar();
    this.despertar();
  }

  async onModuleDestroy(): Promise<void> {
    this.detenido = true;
    if (this.temporizadorDeBarrido) clearTimeout(this.temporizadorDeBarrido);
    for (const t of this.temporizadoresDeTareas) clearInterval(t);
    const escucha = this.escucha;
    this.escucha = null;
    escucha?.release(true);
    await this.drenando?.catch(() => undefined);
  }

  /** Pide un drenaje de pendientes. Varias señales seguidas se juntan en una sola vuelta extra. */
  despertar(): void {
    if (this.detenido) return;
    if (this.drenando) {
      this.pidieronOtraVuelta = true;
      return;
    }
    this.drenando = this.drenar().finally(() => (this.drenando = null));
  }

  private async drenar(): Promise<void> {
    try {
      do {
        this.pidieronOtraVuelta = false;
        let r: ResultadoDeLote;
        do r = await this.procesarLote();
        while (r.reservados > 0 && !this.detenido);
      } while (this.pidieronOtraVuelta && !this.detenido);
      this.programarBarrido();
    } catch (error) {
      if (!this.detenido) this.logger.error({ err: error }, 'El relevo falló al drenar eventos; se reintenta en el barrido.');
      if (!this.detenido) this.armarBarrido();
    }
  }

  /**
   * El barrido de respaldo se arma siempre mientras el relevo esté activo: `LISTEN/NOTIFY` no funciona detrás del pooler de
   * Neon (modo transacción), y sin barrido un evento emitido después del último drenaje no se consumiría nunca. El costo es
   * una consulta liviana cada `RELEVO_BARRIDO_SEGUNDOS`; con `LISTEN` operativo, los eventos se consumen al instante igual.
   */
  private programarBarrido(): void {
    this.armarBarrido();
  }

  private armarBarrido(): void {
    if (this.detenido || this.temporizadorDeBarrido) return;
    this.temporizadorDeBarrido = setTimeout(() => {
      this.temporizadorDeBarrido = null;
      void this.escuchar().then(() => this.despertar());
    }, this.config.RELEVO_BARRIDO_SEGUNDOS * 1000);
    this.temporizadorDeBarrido.unref();
  }

  /** Conexión del grupo `sistema` en `LISTEN`: `emitir` avisa con `pg_notify` al confirmar. */
  private async escuchar(): Promise<void> {
    if (this.escucha || this.detenido) return;
    try {
      const cliente = await this.db.sistema.connect();
      cliente.on('notification', () => this.despertar());
      cliente.on('error', (error) => {
        this.logger.warn({ err: error }, 'Se perdió la escucha del relevo; se retoma en el barrido.');
        if (this.escucha === cliente) this.escucha = null;
        cliente.release(true);
      });
      await cliente.query(`listen ${CANAL_DE_EVENTOS}`);
      if (this.detenido) cliente.release(true);
      else this.escucha = cliente;
    } catch (error) {
      this.logger.warn({ err: error }, 'El relevo no pudo escuchar señales; solo trabajará por barrido.');
    }
  }

  // ---- Tareas periódicas ---------------------------------------------------------------------

  private iniciarTareas(): void {
    for (const tarea of this.tareas.todas()) {
      const correr = () => void this.ejecutarTarea(tarea.nombre);
      const t = setInterval(correr, tarea.cadaSegundos * 1000);
      t.unref();
      this.temporizadoresDeTareas.push(t);
      correr();
    }
  }

  async ejecutarTarea(nombre: string): Promise<void> {
    const tarea = this.tareas.todas().find((t) => t.nombre === nombre);
    if (!tarea) throw new Error(`No existe la tarea «${nombre}».`);
    try {
      await tarea.ejecutar();
    } catch (error) {
      this.logger.error({ err: error, tarea: nombre }, 'La tarea periódica falló.');
    }
  }

  // ---- Lote ----------------------------------------------------------------------------------

  /** Reserva un lote, entrega cada evento a sus consumidores y registra el resultado. */
  async procesarLote(ahora: Date = this.reloj()): Promise<ResultadoDeLote> {
    const reservados = await this.reservar(ahora);
    const resultado: ResultadoDeLote = { reservados: reservados.length, entregados: 0, reintentos: 0, fallidos: 0 };
    for (const evento of reservados) {
      const error = await this.entregar(evento);
      if (error === null) {
        await this.registrar(evento.id, ahora, null, 'entregado');
        resultado.entregados++;
      } else if (evento.intentos >= MAX_INTENTOS) {
        this.logger.error({ eventoId: evento.id, tipo: evento.tipo, empresaId: evento.tenant_id, intentos: evento.intentos }, `El evento falló definitivamente: ${error}`);
        await this.registrar(evento.id, ahora, error, 'fallido');
        resultado.fallidos++;
      } else {
        await this.registrar(evento.id, ahora, error, 'reintento', esperaDeReintento(evento.intentos));
        resultado.reintentos++;
      }
    }
    return resultado;
  }

  /** Una sola sentencia atómica: toma el lote sin bloquear a otros relevos, lo posterga y suma el intento. */
  private async reservar(ahora: Date): Promise<Reservado[]> {
    const { rows } = await this.db.sistema.query<Reservado>(
      `with lote as (
         select id from core.eventos_salida
          where procesado_en is null and fallido_en is null and disponible_en <= $1
          order by disponible_en, id
          limit $2
          for update skip locked)
       update core.eventos_salida e
          set disponible_en = $1::timestamptz + make_interval(secs => $3), intentos = e.intentos + 1
         from lote
        where e.id = lote.id
       returning e.id, e.tenant_id, e.tipo, e.intentos`,
      [ahora, TAMANO_DE_LOTE, RESERVA_SEGUNDOS],
    );
    return rows;
  }

  private async registrar(id: string, ahora: Date, error: string | null, estado: 'entregado' | 'fallido' | 'reintento', espera = 0): Promise<void> {
    const mensaje = error?.slice(0, 500) ?? null;
    if (estado === 'entregado') {
      await this.db.sistema.query('update core.eventos_salida set procesado_en = $2, ultimo_error = null where id = $1', [id, ahora]);
    } else if (estado === 'fallido') {
      await this.db.sistema.query('update core.eventos_salida set fallido_en = $2, ultimo_error = $3 where id = $1', [id, ahora, mensaje]);
    } else {
      await this.db.sistema.query(
        'update core.eventos_salida set disponible_en = $2::timestamptz + make_interval(secs => $4), ultimo_error = $3 where id = $1',
        [id, ahora, mensaje, espera],
      );
    }
  }

  // ---- Entrega -------------------------------------------------------------------------------

  /** Devuelve nulo si todos los consumidores quedaron al día, o los mensajes de los que fallaron. */
  private async entregar(evento: Reservado): Promise<string | null> {
    const aplicables = this.consumidores.para(evento.tipo);
    if (aplicables.length === 0) return null;
    let ctx: ContextoDeHerramienta;
    try {
      ctx = await this.contextoDeSistema(evento.tenant_id);
    } catch (error) {
      return `contexto: ${mensajeDe(error)}`;
    }
    const errores: string[] = [];
    for (const consumidor of aplicables) {
      try {
        await this.entregarA(consumidor, evento, ctx);
      } catch (error) {
        errores.push(`${consumidor.nombre}: ${mensajeDe(error)}`);
      }
    }
    return errores.length ? errores.join(' | ') : null;
  }

  /**
   * Contexto sin persona (`canal: 'sistema'`). Los módulos y permisos los calcula `ServicioDeAcceso`
   * como para un administrador de la empresa, de modo que `puedeEscribir` significa «módulo vigente».
   */
  private async contextoDeSistema(empresaId: string): Promise<ContextoDeHerramienta> {
    const { modulos, permisos } = await this.acceso.cargarAcceso('owner', empresaId, 'sistema');
    return { requestId: `relevo-${empresaId}`, empresaId, usuarioId: 'sistema', rol: null, permisos, modulos, canal: 'sistema' };
  }

  /** Una transacción por consumidor: marca procesado y ejecuta, o revierte ambas cosas. */
  private async entregarA(consumidor: Consumidor, evento: Reservado, ctx: ContextoDeHerramienta): Promise<void> {
    const vigente = ctx.modulos.some((m) => m.codigo === consumidor.modulo && m.puedeEscribir);
    await this.db.conEmpresa({ empresaId: ctx.empresaId, usuarioId: 'sistema' }, async (tx) => {
      const marca = await tx.execute(
        sql`insert into core.eventos_procesados (tenant_id, evento_id, consumidor)
            values (current_setting('app.tenant_id', true), ${evento.id}, ${consumidor.nombre})
            on conflict do nothing returning evento_id`,
      );
      if (marca.rows.length === 0 || !vigente) return;
      const fila = await tx.execute<{ carga: unknown; creado_en: string | Date }>(
        sql`select carga, creado_en from core.eventos_salida where id = ${evento.id}`,
      );
      const f = fila.rows[0];
      if (!f) return;
      await consumidor.manejar(
        { id: evento.id, tipo: evento.tipo as TipoDeEvento, carga: f.carga, creadoEn: new Date(f.creado_en) },
        ctx,
        tx,
      );
    });
  }
}

const mensajeDe = (error: unknown): string => (error instanceof Error ? error.message : String(error));
