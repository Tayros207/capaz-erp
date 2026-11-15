import { Inject, Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../../infra/database/database.service.js';
import { RELOJ, type Reloj } from './reloj.js';
import { RegistroDeTareas } from './registro-de-tareas.js';

const DIA_MS = 86_400_000;

export type ResultadoDeMantenimiento = { idempotencia: number; confirmaciones: number; eventosProcesados: number; eventosEntregados: number };

/** Mantenimiento diario con el grupo `sistema` (cruza empresas; solo borra por fecha). */
@Injectable()
export class Mantenimiento implements OnModuleInit {
  private readonly reloj: Reloj;

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(RegistroDeTareas) private readonly tareas: RegistroDeTareas,
    @Optional() @Inject(RELOJ) reloj?: Reloj,
  ) {
    this.reloj = reloj ?? (() => new Date());
  }

  onModuleInit(): void {
    this.tareas.agregar({ nombre: 'mantenimiento_diario', cadaSegundos: 86_400, ejecutar: async () => void (await this.ejecutar()) });
  }

  /** Borra `idempotencia` de más de 30 días, `confirmaciones_usadas` de más de 1 y eventos procesados de más de 90. */
  async ejecutar(ahora: Date = this.reloj()): Promise<ResultadoDeMantenimiento> {
    const hace = (dias: number) => new Date(ahora.getTime() - dias * DIA_MS);
    const borrar = async (consulta: string, limite: Date) => (await this.db.sistema.query(consulta, [limite])).rowCount ?? 0;
    return {
      idempotencia: await borrar('delete from core.idempotencia where creado_en < $1', hace(30)),
      confirmaciones: await borrar('delete from core.confirmaciones_usadas where usado_en < $1', hace(1)),
      eventosProcesados: await borrar('delete from core.eventos_procesados where procesado_en < $1', hace(90)),
      eventosEntregados: await borrar('delete from core.eventos_salida where procesado_en < $1', hace(90)),
    };
  }
}
