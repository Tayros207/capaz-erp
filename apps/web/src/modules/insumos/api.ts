import type { EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';
import { opcionDeArticulo, type OpcionDeRegistro } from './logica.ts';

// Las pantallas de Inventario solo hablan con el servidor por herramientas tipadas.

export const POR_PAGINA = 25;
/** Clave raíz de todas las consultas del módulo (para invalidar tras escribir). */
export const CLAVE_INSUMOS = ['insumos'] as const;

export const verArticulo = (id: string) => llamar('articulo_ver', { id });
export const listarExistencias = (args: EntradaDe<'existencias_listar'>) => llamar('existencias_listar', args);
export const listarMovimientos = (args: EntradaDe<'existencias_movimientos_listar'>) => llamar('existencias_movimientos_listar', args);
export const listarSucursales = () => llamar('sucursales_listar', {});
export const moverExistencia = (args: EntradaDe<'existencia_mover'>) => llamar('existencia_mover', args);
export const activarArticulo = (args: EntradaDe<'articulo_activar'>) => llamar('articulo_activar', args);
export const editarArticulo = (args: EntradaDe<'articulo_editar'>) => llamar('articulo_editar', args);
export const archivarArticulo = (id: string) => llamar('articulo_archivar', { id });

/** Crítica: el servidor devuelve el resumen (de cuánto a cuánto) y la persona confirma antes de ajustar. */
export const ajustarExistencia = (args: EntradaDe<'existencia_ajustar'>) =>
  llamarConfirmando('existencia_ajustar', args, { titulo: 'Ajustar existencia', textoConfirmar: 'Ajustar' });

/** Artículos activos para el selector de la hoja «Entrada / Salida». */
export async function buscarArticulos(texto: string): Promise<OpcionDeRegistro[]> {
  const r = datosOError(await llamar('articulos_listar', { buscar: texto, limite: 8 }));
  return r.items.map(opcionDeArticulo);
}

/** Productos del catálogo para ponerlos bajo control de inventario. */
export async function buscarProductos(texto: string): Promise<OpcionDeRegistro[]> {
  const r = datosOError(await llamar('productos_buscar', { texto, limite: 8 }));
  return r.items.map((p) => ({ id: p.id, nombre: p.nombre, ...(p.codigo && { detalle: p.codigo }) }));
}
