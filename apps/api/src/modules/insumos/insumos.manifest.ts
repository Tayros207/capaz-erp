import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoInsumos: ManifiestoDeEntrada = {
  codigo: 'insumos',
  nombre: 'Inventario',
  descripcion: 'Existencias de insumos y productos, con sus movimientos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['insumos:ver', 'insumos:editar'],
  permisosPorNivel: {
    completo: ['insumos:ver', 'insumos:editar'],
    lectura: ['insumos:ver'],
  },
  secciones: [],
  familia: 'inventario',
  orden: 1,
  acento: 'esmeralda',
  icono: 'insumos',
  enConstruccion: true,
};
