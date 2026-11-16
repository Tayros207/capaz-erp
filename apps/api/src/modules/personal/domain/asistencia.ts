import { ESTADOS_CON_HORA_DE_ASISTENCIA, type EstadoDeAsistencia } from '@capaz/shared';

// Reglas puras de la asistencia diaria. La hora la pone el servidor; la persona elige el estado.

export type AsistenciaDeDia = { estado: EstadoDeAsistencia; entrada: Date | null; salida: Date | null; nota: string | null };
export type MarcaDeAsistencia = { estado?: EstadoDeAsistencia; entrada?: boolean; salida?: boolean; nota?: string | null };
export type ResultadoDeMarca = { ok: true; asistencia: AsistenciaDeDia } | { ok: false; motivo: string };

export const tieneHora = (estado: EstadoDeAsistencia): boolean => (ESTADOS_CON_HORA_DE_ASISTENCIA as readonly string[]).includes(estado);

/**
 * Aplica una marca a lo que ya había del día (`null` si nadie marcó todavía).
 * - Falta, permiso y descanso no llevan horas: se limpian y no admiten marcar entrada o salida.
 * - Marcar la entrada pone «presente» si no se dijo otro estado de asistencia.
 * - La salida exige entrada y no se marca dos veces; la entrada tampoco.
 */
export function aplicarMarca(actual: AsistenciaDeDia | null, marca: MarcaDeAsistencia, ahora: Date): ResultadoDeMarca {
  let estado: EstadoDeAsistencia = marca.estado ?? actual?.estado ?? 'presente';
  let entrada = actual?.entrada ?? null;
  let salida = actual?.salida ?? null;
  if (!marca.entrada && !marca.salida && marca.estado === undefined) return { ok: false, motivo: 'Indica el estado o marca la entrada o la salida.' };
  if ((marca.entrada || marca.salida) && marca.estado !== undefined && !tieneHora(marca.estado)) {
    return { ok: false, motivo: 'Una falta, un permiso o un descanso no llevan hora de entrada ni de salida.' };
  }
  if (marca.entrada) {
    if (entrada) return { ok: false, motivo: 'Ya se marcó la entrada de hoy.' };
    entrada = ahora;
    if (marca.estado === undefined && !tieneHora(estado)) estado = 'presente';
  }
  if (marca.salida) {
    if (!entrada) return { ok: false, motivo: 'Primero hay que marcar la entrada.' };
    if (salida) return { ok: false, motivo: 'Ya se marcó la salida de hoy.' };
    if (ahora < entrada) return { ok: false, motivo: 'La salida no puede ser anterior a la entrada.' };
    salida = ahora;
  }
  if (!tieneHora(estado)) {
    entrada = null;
    salida = null;
  }
  const nota = marca.nota === undefined ? (actual?.nota ?? null) : marca.nota?.trim() || null;
  return { ok: true, asistencia: { estado, entrada, salida, nota } };
}

/** Corregir es para un día ya pasado; el de hoy se marca. Un día futuro no existe. */
export function comprobarCorreccion(fecha: string, hoy: string): { ok: true } | { ok: false; motivo: string } {
  if (fecha > hoy) return { ok: false, motivo: 'No se puede registrar la asistencia de un día futuro.' };
  if (fecha === hoy) return { ok: false, motivo: 'La asistencia de hoy se marca, no se corrige.' };
  return { ok: true };
}

/** Lo que queda al corregir: el nuevo estado, sin horas si no las admite, y el motivo como nota. */
export function aplicarCorreccion(actual: AsistenciaDeDia | null, estado: EstadoDeAsistencia, motivo: string): AsistenciaDeDia {
  const conservar = tieneHora(estado);
  return { estado, entrada: conservar ? (actual?.entrada ?? null) : null, salida: conservar ? (actual?.salida ?? null) : null, nota: `Corrección: ${motivo.trim()}` };
}
