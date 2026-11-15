import type { EntradaDe, ProductoDto, Respuesta } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

export type EstadoDeListado = 'activos' | 'archivados' | 'todos';

/** Error de una llamada rechazada; lo usan las consultas con caché, que necesitan una excepción. */
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

export function listarProductos(estado: EstadoDeListado, cursor?: string) {
  const args: EntradaDe<'productos_listar'> = { estado, limite: POR_PAGINA };
  if (cursor) args.cursor = cursor;
  return llamar('productos_listar', args);
}

export const verProducto = (id: string) => llamar('productos_ver', { id });
export const buscarProductos = (texto: string, limite = 20) => llamar('productos_buscar', { texto, limite });
export const crearProducto = (args: EntradaDe<'productos_crear'>) => llamar('productos_crear', args);
export const editarProducto = (args: EntradaDe<'productos_editar'>) => llamar('productos_editar', args);
export const archivarProducto = (id: string) => llamar('productos_archivar', { id });
export const restaurarProducto = (id: string) => llamar('productos_restaurar', { id });

export type { ProductoDto };
