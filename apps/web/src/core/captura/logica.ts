import { MAXIMO_DE_ESPERA_DE_CAPTURA_MS, type MetricasDeBorradores, type OrigenDeCaptura } from '@capaz/shared';

// Lógica pura de la pantalla de dictado.

/** `voz` si el texto vino del reconocedor (aunque después se retoque); `texto` si se escribió entero. */
export const decidirOrigen = (vinoDeVoz: boolean): OrigenDeCaptura => (vinoDeVoz ? 'voz' : 'texto');

/** Milisegundos desde que se tocó el micrófono (o la primera tecla), topados al máximo del contrato. */
export function transcurridoMs(inicio: number | null, ahora: number): number {
  if (inicio === null) return 0;
  return Math.max(0, Math.min(Math.round(ahora - inicio), MAXIMO_DE_ESPERA_DE_CAPTURA_MS));
}

/** El primer instante vale; los siguientes no lo mueven. */
export const instanteDeInicio = (actual: number | null, ahora: number): number => actual ?? ahora;

/** Del primer día del mes en curso a hoy (`AAAA-MM-DD`, día de Lima). */
export const rangoDelMes = (hoy: string): { desde: string; hasta: string } => ({ desde: `${hoy.slice(0, 8)}01`, hasta: hoy });

export function lineaDeMedicion(m: Pick<MetricasDeBorradores, 'propuestos' | 'pctSinCorregir' | 'medianaSegundos'>): string {
  if (m.propuestos === 0) return 'Aún sin dictados';
  const partes = [`Este mes: ${m.propuestos} ${m.propuestos === 1 ? 'dictado' : 'dictados'}`];
  if (m.pctSinCorregir !== null) partes.push(`${Math.round(m.pctSinCorregir)} % sin corregir`);
  if (m.medianaSegundos !== null) partes.push(`${m.medianaSegundos} s`);
  return partes.join(' · ');
}

/** Texto para la persona según el código de error de la herramienta. */
export function mensajeDeErrorDeCaptura(codigo: string, mensaje: string): string {
  switch (codigo) {
    case 'sin_conexion':
      return 'No hay conexión con el servidor. Tu texto sigue aquí; inténtalo de nuevo.';
    case 'sin_permiso':
      return 'No tienes permiso para registrar por dictado.';
    case 'validacion':
      return mensaje || 'Revisa el texto: no se pudo enviar.';
    case 'demasiados_intentos':
      return 'Demasiados intentos seguidos. Espera un momento e inténtalo otra vez.';
    default:
      return mensaje || 'No se pudo interpretar el texto. Inténtalo otra vez.';
  }
}

export const hayTexto = (texto: string): boolean => texto.trim().length > 0;
