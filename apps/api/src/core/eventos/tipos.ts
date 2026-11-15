import type { TipoDeEvento } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

// Tipos del bus de eventos entre módulos. La implementación (emitir, consumidores, tareas) llega con la fase 8.

export type EventoEntregado = {
  id: string;
  tipo: TipoDeEvento;
  carga: unknown;
  creadoEn: Date;
};

export type Consumidor = {
  nombre: string;
  modulo: string;
  evento: TipoDeEvento | '*';
  manejar: (
    e: EventoEntregado,
    ctx: ContextoDeHerramienta,
    tx: Transaccion,
  ) => Promise<void>;
};

export type TareaPeriodica = {
  nombre: string;
  cadaSegundos: number;
  ejecutar: () => Promise<void>;
};
