import type { EntradaDe, Respuesta } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

export const POR_PAGINA = 25;

/** Error de una llamada rechazada; las consultas con caché necesitan una excepción. */
export class ErrorDeApi extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

/** Los datos de una respuesta correcta, o una excepción con el mensaje del servidor. */
export function datosOError<S>(r: Respuesta<S>): S {
  if (r.ok && 'datos' in r) return r.datos;
  if ('error' in r) throw new ErrorDeApi(r.error.codigo, r.error.mensaje);
  throw new ErrorDeApi('requiere_confirmacion', 'La operación pide una confirmación que esta pantalla no maneja.');
}

export function listarReglas(cursor?: string) {
  const args: EntradaDe<'reglas_listar'> = { limite: POR_PAGINA };
  if (cursor) args.cursor = cursor;
  return llamar('reglas_listar', args);
}
export const verRegla = (id: string) => llamar('regla_ver', { id });
export const guardarRegla = (args: EntradaDe<'regla_guardar'>) => llamar('regla_guardar', args);
export const desactivarRegla = (id: string) => llamar('regla_desactivar', { id });
export const probarRegla = (id: string, datos: Record<string, unknown>) => llamar('regla_probar', { id, datos });
export const ejecutarRegla = (id: string, datos: Record<string, unknown>) => llamar('regla_ejecutar', { id, datos });

// SIEMPRE crítica: la persona ve qué hará la regla y confirma antes de que se encienda.
export const activarRegla = (id: string) =>
  llamarConfirmando('regla_activar', { id }, { titulo: 'Activar la regla', textoConfirmar: 'Activar' });

export function listarEjecuciones(filtro: { reglaId?: string; simulada?: boolean }, cursor?: string) {
  const args: EntradaDe<'regla_ejecuciones_listar'> = { limite: POR_PAGINA };
  if (filtro.reglaId) args.reglaId = filtro.reglaId;
  if (filtro.simulada !== undefined) args.simulada = filtro.simulada;
  if (cursor) args.cursor = cursor;
  return llamar('regla_ejecuciones_listar', args);
}
