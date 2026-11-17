import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Categorías, ficha de catálogo y unidades de un producto (0025).

export const listarCategorias = (incluirArchivadas = false) => llamar('categorias_producto_listar', { incluirArchivadas });
export const guardarCategoria = (args: EntradaDe<'categorias_producto_guardar'>) => llamar('categorias_producto_guardar', args);
export const archivarCategoria = (id: string) => llamar('categorias_producto_archivar', { id });
export const verFicha = (productoId: string) => llamar('productos_ficha_ver', { productoId });
export const guardarFicha = (args: EntradaDe<'productos_ficha_guardar'>) => llamar('productos_ficha_guardar', args);
export const listarUnidades = (productoId: string) => llamar('productos_unidades_listar', { productoId });
export const guardarUnidad = (args: EntradaDe<'productos_unidad_guardar'>) => llamar('productos_unidad_guardar', args);
export const eliminarUnidad = (id: string) => llamar('productos_unidad_eliminar', { id });
