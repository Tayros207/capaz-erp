import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoReportes: ManifiestoDeEntrada = {
  codigo: 'reportes',
  nombre: 'Reportes',
  descripcion: 'Cifras y reportes del negocio en un solo lugar.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['reportes:ver', 'reportes:editar'],
  permisosPorNivel: {
    completo: ['reportes:ver', 'reportes:editar'],
    lectura: ['reportes:ver'],
  },
  secciones: [],
  familia: 'analisis',
  orden: 1,
  acento: 'cian',
  icono: 'reportes',
  enConstruccion: true,
};
