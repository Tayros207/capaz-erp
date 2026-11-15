import { MAX_FILAS_EXPORTAR, type EntidadDeIntercambio } from '@capaz/shared';
import type { ContextoDeEmpresa, Transaccion } from '../../infra/database/con-empresa.js';
import { listarClientes, type Cliente } from '../clientes/repositories/clientes.repository.js';
import { listarProductos, type Producto } from '../productos/repositories/productos.repository.js';
import { ENCABEZADOS_DE_EXPORTACION, textoDeMilesimas } from './columnas.js';

const filaDeCliente = (c: Cliente): string[] => [c.tipo, c.clase, c.nombre, c.documentoTipo ?? '', c.documentoNumero ?? '', c.telefono ?? '', c.correo ?? '', c.direccion ?? '', c.notas ?? ''];
const filaDeProducto = (p: Producto): string[] => [p.codigo ?? '', p.nombre, p.tipo, p.unidad, textoDeMilesimas(p.precioUnitarioMilesimas), p.afectoIgv ? 'si' : 'no', p.descripcion ?? ''];

/** Todas las páginas del listado (el repositorio de S3, ya aislado por empresa) hasta pasar el máximo. */
async function recorrer<T>(pagina: (cursor?: string) => Promise<{ items: T[]; siguiente: string | null } | 'cursor_invalido'>): Promise<T[]> {
  const todas: T[] = [];
  let cursor: string | undefined;
  while (todas.length <= MAX_FILAS_EXPORTAR) {
    const r = await pagina(cursor);
    if (r === 'cursor_invalido') throw new Error('Cursor inválido al exportar.');
    todas.push(...r.items);
    if (!r.siguiente) break;
    cursor = r.siguiente;
  }
  return todas;
}

/** Encabezado y filas (en texto, sin proteger: el escritor de CSV prefija las fórmulas) de la entidad. */
export async function filasParaExportar(
  tx: Transaccion,
  ctx: ContextoDeEmpresa,
  entidad: EntidadDeIntercambio,
  incluirArchivados: boolean,
): Promise<{ filas: string[][]; truncado: boolean }> {
  const estado = incluirArchivados ? 'todos' : 'activos';
  const registros =
    entidad === 'clientes'
      ? (await recorrer((cursor) => listarClientes(tx, ctx, { limite: 100, cursor, estado }))).map(filaDeCliente)
      : (await recorrer((cursor) => listarProductos(tx, ctx, { limite: 100, cursor, estado }))).map(filaDeProducto);
  const truncado = registros.length > MAX_FILAS_EXPORTAR;
  return { filas: [[...ENCABEZADOS_DE_EXPORTACION[entidad]], ...registros.slice(0, MAX_FILAS_EXPORTAR)], truncado };
}
