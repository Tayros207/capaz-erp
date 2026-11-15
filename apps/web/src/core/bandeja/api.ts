import type { Borrador, EntradaDe, Respuesta } from '@capaz/shared';
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

export function datosOError<S>(r: Respuesta<S>): S {
  if (r.ok && 'datos' in r) return r.datos;
  if ('error' in r) throw new ErrorDeApi(r.error.codigo, r.error.mensaje);
  throw new ErrorDeApi('requiere_confirmacion', 'La operación pide una confirmación que esta pantalla no maneja.');
}

export type FiltrosDeBandeja = { estado: Borrador['estado'] | 'todos'; modulo: string; origen: Borrador['origen'] | 'todos' };

export function listarBorradores(filtros: FiltrosDeBandeja, cursor?: string) {
  const args: EntradaDe<'borradores_listar'> = { limite: POR_PAGINA };
  if (filtros.estado !== 'todos') args.estado = filtros.estado;
  if (filtros.modulo.trim()) args.modulo = filtros.modulo.trim();
  if (filtros.origen !== 'todos') args.origen = filtros.origen;
  if (cursor) args.cursor = cursor;
  return llamar('borradores_listar', args);
}

export const verBorrador = (id: string) => llamar('borrador_ver', { id });
export const corregirBorrador = (id: string, args: Record<string, unknown>) => llamar('borrador_corregir', { id, args });
export const descartarBorrador = (id: string, motivo: string) => llamar('borrador_descartar', { id, motivo });

/**
 * Aprueba un borrador. Si la herramienta propuesta es crítica, el servidor responde `requiereConfirmacion`
 * y se pide la confirmación a la persona en dos pasos.
 */
export const aprobarBorrador = (id: string, resumen: string) =>
  llamarConfirmando('borrador_aprobar', { id }, {
    titulo: 'Confirmar operación crítica',
    textoConfirmar: `Aprobar «${resumen}»`,
    peligroso: true,
  });
