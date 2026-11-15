// Cuántas llamadas a herramientas están en vuelo y cómo terminó la última: lo que muestra el
// indicador «Guardando… / Guardado / Sin conexión». Solo cuenta; no toca la cola.
// Portado de Cotizín (`estado-del-llamador`), con un resultado más: `sin_conexion`.

export type ResultadoDelLlamador = 'ok' | 'error' | 'sin_conexion';

export type EstadoDelLlamador = {
  /** Llamadas que salieron y todavía no responden. */
  enVuelo: number;
  ultimoResultado: ResultadoDelLlamador | null;
  /** Cuántas llamadas han terminado (cada una renueva el «Guardado» de unos segundos). */
  terminadas: number;
};

export const ESTADO_INICIAL_DEL_LLAMADOR: EstadoDelLlamador = { enVuelo: 0, ultimoResultado: null, terminadas: 0 };

export type EventoDelLlamador = { tipo: 'salio' } | { tipo: 'termino'; ok: boolean; sinConexion?: boolean };

export function reducirEstadoDelLlamador(estado: EstadoDelLlamador, evento: EventoDelLlamador): EstadoDelLlamador {
  if (evento.tipo === 'salio') return { ...estado, enVuelo: estado.enVuelo + 1 };
  return {
    enVuelo: Math.max(0, estado.enVuelo - 1),
    ultimoResultado: evento.ok ? 'ok' : evento.sinConexion ? 'sin_conexion' : 'error',
    terminadas: estado.terminadas + 1,
  };
}

/** Lo que dice el indicador, o nulo si no hay nada que decir (`guardadoVigente`: el «Guardado» aún no vence). */
export function textoDelIndicador(estado: EstadoDelLlamador, guardadoVigente: boolean): 'Guardando…' | 'Guardado' | 'Sin conexión' | null {
  if (estado.enVuelo > 0) return 'Guardando…';
  if (estado.ultimoResultado === 'sin_conexion') return 'Sin conexión';
  if (estado.ultimoResultado === 'ok' && guardadoVigente) return 'Guardado';
  return null;
}
