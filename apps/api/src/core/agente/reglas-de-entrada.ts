import type { MotivoDeErrorDelAgente } from '@capaz/shared';
import type { Config } from '../../infra/config/config.js';
import { SEGUNDOS_PARA_DAR_POR_MUERTO, type TurnoAbierto } from './repositorio.js';

export { SEGUNDOS_PARA_DAR_POR_MUERTO };

// Las reglas que deciden SI un turno puede empezar y qué hacer con un reintento. Puras: se prueban sin base ni modelo.

export const LIMITE_DE_TURNOS_POR_MINUTO = 6;
export const LIMITE_DE_TURNOS_POR_DIA = 300;
/** Tiempo máximo de un turno entero. Cabe de sobra en los 300 s por defecto de la función. */
export const MILISEGUNDOS_POR_TURNO = 120_000;

export type RechazoDeEntrada = { motivo: MotivoDeErrorDelAgente; mensaje: string };

/** Lo que se comprueba sin tocar la base. */
export function rechazoPrevio(p: { proveedor: Config['AGENTE_PROVEEDOR']; puedeEntrarAAlgunModulo: boolean }): RechazoDeEntrada | null {
  if (p.proveedor === 'apagado') return { motivo: 'apagado', mensaje: 'El asistente todavía no está activo en este sistema.' };
  if (!p.puedeEntrarAAlgunModulo) return { motivo: 'apagado', mensaje: 'No tienes ningún módulo disponible para el asistente.' };
  return null;
}

/** El tope mensual de la empresa y el ritmo de esta persona. Ambos salen de `core.uso`, no de la memoria del servidor. */
export function rechazoPorLimites(p: { gastoMicrousd: number; topeMicrousd: number; turnosUltimoMinuto: number; turnosUltimoDia: number }): RechazoDeEntrada | null {
  if (p.gastoMicrousd >= p.topeMicrousd) return { motivo: 'tope_mensual', mensaje: 'Se alcanzó el tope de uso de este mes.' };
  if (p.turnosUltimoMinuto >= LIMITE_DE_TURNOS_POR_MINUTO || p.turnosUltimoDia >= LIMITE_DE_TURNOS_POR_DIA) {
    return { motivo: 'limite_de_ritmo', mensaje: 'Estás enviando mensajes muy rápido. Espera un momento e inténtalo otra vez.' };
  }
  return null;
}

export type DecisionDeReintento = 'responder_guardado' | 'turno_en_curso' | 'interrumpir' | 'retomar';

const hayAlgo = (x: unknown): boolean => Array.isArray(x) && x.length > 0;

/**
 * Qué hacer cuando llega un turno con un `turnoId` que ya existe (la web reintentó):
 *  - ya terminó → se entrega lo guardado, sin llamar al modelo;
 *  - sigue en curso y es reciente → se rechaza (no se corren dos a la vez);
 *  - se cortó pero ya hizo algo (acciones o borradores) → se cierra como interrumpido y NO se repite;
 *  - se cortó sin haber hecho nada → se retoma, porque repetir es inocuo.
 */
export function decidirReintento(previo: Extract<TurnoAbierto, { tipo: 'existente' }>): DecisionDeReintento {
  if (previo.estado === 'completo') return 'responder_guardado';
  if (previo.estado === 'en_curso' && previo.edadSegundos < SEGUNDOS_PARA_DAR_POR_MUERTO) return 'turno_en_curso';
  if (hayAlgo(previo.metadatos.acciones) || hayAlgo(previo.metadatos.borradores)) return 'interrumpir';
  return 'retomar';
}
