import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import type { Disparador } from '@capaz/shared';
import type { Logger } from 'pino';
import { DatabaseService } from '../../infra/database/database.service.js';
import { LOGGER } from '../../infra/logger/logger.js';
import { RELOJ, type Reloj } from '../eventos/reloj.js';
import { RegistroDeConsumidores } from '../eventos/registro-de-consumidores.js';
import { RegistroDeTareas } from '../eventos/registro-de-tareas.js';
import type { EventoEntregado } from '../eventos/tipos.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';
import { ServicioDeAcceso } from '../modulos/acceso.service.js';
import { diaLocal, sumarDias } from './condiciones.js';
import { pruebaDeModuloVence } from './fuentes.js';
import { MotorDeReglas, type Opciones } from './motor.js';
import * as repo from './repositorio.js';
import { RegistroDeFuentesDeTiempo } from './tipos.js';
import type { Transaccion } from '../../infra/database/con-empresa.js';

const COMODIN = 'webhook.recibido';

/** Disparo por evento (consumidor `'*'`) y por tiempo (tarea cada 60 s). El manual vive en `regla_ejecutar`. */
@Injectable()
export class DisparadoresDeReglas implements OnModuleInit {
  private readonly reloj: Reloj;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(MotorDeReglas) private readonly motor: MotorDeReglas,
    @Inject(RegistroDeConsumidores) private readonly consumidores: RegistroDeConsumidores,
    @Inject(RegistroDeTareas) private readonly tareas: RegistroDeTareas,
    @Inject(RegistroDeFuentesDeTiempo) private readonly fuentes: RegistroDeFuentesDeTiempo,
    @Inject(ServicioDeAcceso) private readonly acceso: ServicioDeAcceso,
    @Inject(LOGGER) private readonly logger: Logger,
    @Optional() @Inject(RELOJ) reloj?: Reloj,
  ) {
    this.reloj = reloj ?? (() => new Date());
  }

  onModuleInit(): void {
    this.fuentes.agregar([pruebaDeModuloVence]);
    this.consumidores.agregar([{ nombre: 'automatizaciones_reglas', modulo: 'core', evento: '*', manejar: (e, ctx, tx) => this.alEvento(e, ctx, tx) }]);
    this.tareas.agregar({ nombre: 'automatizaciones_tiempo', cadaSegundos: 60, ejecutar: async () => void (await this.dispararPorTiempo()) });
  }

  private opciones(empresaId: string, creadoPor: () => string, ahora: Date): Opciones {
    return {
      ahora,
      registrarSinCoincidencia: false,
      contextoAutomatico: () => this.acceso.contextoDe(empresaId, creadoPor(), 'sistema', `regla-${empresaId}`),
    };
  }

  // ---- Evento -------------------------------------------------------------------------------

  /** Reglas activas por evento o webhook cuyo disparador coincide con este evento. */
  async alEvento(e: EventoEntregado, ctx: ContextoDeHerramienta, tx: Transaccion): Promise<void> {
    const carga = (e.carga && typeof e.carga === 'object' && !Array.isArray(e.carga) ? e.carga : {}) as Record<string, unknown>;
    const coincide = (d: Disparador) => (d.tipo === 'evento' && d.evento === e.tipo) || (d.tipo === 'webhook' && (e.tipo as string) === COMODIN && carga.evento === d.evento);
    const reglas = [...(await repo.activasDeTipo(tx, 'evento')), ...(await repo.activasDeTipo(tx, 'webhook'))].filter((r) => coincide(r.disparador as Disparador));
    const ahora = this.reloj();
    for (const r of reglas) {
      const raiz = { disparo: { tipo: r.disparadorTipo, evento: e.tipo, eventoId: e.id }, datos: carga };
      const o = this.opciones(ctx.empresaId, () => r.creadoPor, ahora);
      await this.motor.procesar(tx, r, raiz, o);
    }
  }

  // ---- Tiempo -------------------------------------------------------------------------------

  /** Una pasada para todas las empresas con reglas de tiempo activas. Repetirla el mismo día no duplica nada. */
  async dispararPorTiempo(ahora: Date = this.reloj()): Promise<{ disparos: number }> {
    // El grupo `sistema` solo ve (id, tenant_id, activa, disparador_tipo): lo justo para saber dónde mirar.
    const { rows } = await this.db.sistema.query<{ tenant_id: string }>(
      `select distinct tenant_id from core.reglas_automaticas where activa and disparador_tipo = 'tiempo'`,
    );
    let disparos = 0;
    for (const { tenant_id: empresaId } of rows) {
      try {
        disparos += await this.deEmpresa(empresaId, ahora);
      } catch (error) {
        this.logger.error({ err: error, empresaId }, 'Falló la evaluación de reglas por tiempo de una empresa.');
      }
    }
    return { disparos };
  }

  private async deEmpresa(empresaId: string, ahora: Date): Promise<number> {
    const ids = await this.db.conEmpresa({ empresaId, usuarioId: 'sistema' }, async (tx) => (await repo.activasDeTipo(tx, 'tiempo')).map((r) => r.id));
    let total = 0;
    for (const id of ids) {
      // Una transacción por regla: si una falla, las demás siguen y lo suyo se reintenta en la próxima pasada.
      try {
        total += await this.db.conEmpresa({ empresaId, usuarioId: 'sistema' }, (tx) => this.deRegla(tx, empresaId, id, ahora));
      } catch (error) {
        this.logger.error({ err: error, empresaId, reglaId: id }, 'Falló una regla por tiempo.');
      }
    }
    return total;
  }

  private async deRegla(tx: Transaccion, empresaId: string, id: string, ahora: Date): Promise<number> {
    const regla = await repo.buscar(tx, id);
    const d = regla?.disparador as Disparador | undefined;
    if (!regla || !regla.activa || d?.tipo !== 'tiempo') return 0;
    const fuente = this.fuentes.obtener(d.fuente);
    if (!fuente) return 0;
    const zona = await repo.zonaHorariaDeLaEmpresa(tx);
    const hoy = diaLocal(ahora, zona);
    const o = this.opciones(empresaId, () => regla.creadoPor, ahora);
    let n = 0;
    for (const c of await fuente.candidatos(tx, ahora)) {
      const fecha = diaLocal(c.fecha, zona);
      if (sumarDias(fecha, d.dias) !== hoy) continue;
      // Reclamar y procesar van en la misma transacción: si falla algo, el disparo no queda gastado.
      if (!(await repo.reclamarDisparo(tx, regla.id, `${c.entidadTipo}:${c.entidadId}:${fecha}`, ahora))) continue;
      const raiz = { disparo: { tipo: 'tiempo', fuente: d.fuente, entidadTipo: c.entidadTipo, entidadId: c.entidadId, fecha }, datos: c.datos };
      await this.motor.procesar(tx, regla, raiz, o);
      n++;
    }
    return n;
  }
}
