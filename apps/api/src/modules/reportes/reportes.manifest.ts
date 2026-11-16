import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoReportes: ManifiestoDeEntrada = {
  codigo: 'reportes',
  nombre: 'Reportes',
  descripcion: 'Indicadores de todos tus módulos por período, con exportación a CSV.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['reportes:ver', 'reportes:exportar'],
  permisosPorNivel: {
    completo: ['reportes:ver', 'reportes:exportar'],
    lectura: ['reportes:ver'],
  },
  secciones: [{ id: 'indicadores', nombre: 'Indicadores', ruta: '/m/reportes', construida: true }],
  familia: 'analisis',
  orden: 1,
  acento: 'cian',
  icono: 'reportes',
  enConstruccion: true,
};
