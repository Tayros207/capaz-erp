import { useSyncExternalStore } from 'react';
import { ESTADO_INICIAL_DEL_LLAMADOR, reducirEstadoDelLlamador, type EstadoDelLlamador, type EventoDelLlamador } from './estado-del-llamador.ts';

// Un solo estado para toda la aplicación (como `notificar`): no hace falta un proveedor.
let estado: EstadoDelLlamador = ESTADO_INICIAL_DEL_LLAMADOR;
const oyentes = new Set<() => void>();

export function anotarLlamada(evento: EventoDelLlamador): void {
  estado = reducirEstadoDelLlamador(estado, evento);
  oyentes.forEach((o) => o());
}

export const almacenDelLlamador = {
  suscribir(oyente: () => void) {
    oyentes.add(oyente);
    return () => void oyentes.delete(oyente);
  },
  leer: (): EstadoDelLlamador => estado,
};

/** Estado actual del llamador: para el indicador «Guardando… / Guardado / Sin conexión». */
export function useEstadoDelLlamador(): EstadoDelLlamador {
  return useSyncExternalStore(almacenDelLlamador.suscribir, almacenDelLlamador.leer);
}
