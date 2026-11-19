import type { ClienteDto, EntradaDe, Respuesta } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

export type EstadoDeListado = 'activos' | 'archivados' | 'todos';

/** Error de una llamada que fue rechazada; lo usan las consultas con caché, que necesitan una excepción. */
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

export const POR_PAGINA = 25;

export function listarClientes(estado: EstadoDeListado, cursor?: string) {
  const args: EntradaDe<'clientes_listar'> = { estado, limite: POR_PAGINA };
  if (cursor) args.cursor = cursor;
  return llamar('clientes_listar', args);
}

export const verCliente = (id: string) => llamar('clientes_ver', { id });
/** Lo que muestran los selectores al abrirse sin haber escrito nada: los primeros por orden alfabético. */
export const primerosClientes = () => llamar('clientes_listar', { estado: 'activos', limite: 8 });
export const buscarClientes = (texto: string, limite = 20) => llamar('clientes_buscar', { texto, limite });
export const crearCliente = (args: EntradaDe<'clientes_crear'>) => llamar('clientes_crear', args);
export const editarCliente = (args: EntradaDe<'clientes_editar'>) => llamar('clientes_editar', args);
export const archivarCliente = (id: string) => llamar('clientes_archivar', { id });
export const restaurarCliente = (id: string) => llamar('clientes_restaurar', { id });

export type { ClienteDto };
