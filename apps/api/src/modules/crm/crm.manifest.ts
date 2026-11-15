import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoCrm: ManifiestoDeEntrada = {
  codigo: 'crm',
  nombre: 'CRM',
  descripcion: 'Clientes potenciales, seguimiento y oportunidades de venta.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['crm:ver', 'crm:editar'],
  permisosPorNivel: {
    completo: ['crm:ver', 'crm:editar'],
    lectura: ['crm:ver'],
  },
  secciones: [],
  familia: 'ventas',
  orden: 1,
  acento: 'cian',
  icono: 'crm',
  enConstruccion: true,
};
