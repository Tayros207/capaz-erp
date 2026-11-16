import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo `crm`: oportunidades por etapas y actividades de seguimiento (FICHAS-OLA-2 §5.1).
// `enConstruccion` y `porDefecto` los cambia solo el integrador.
export const manifiestoCrm: ManifiestoDeEntrada = {
  codigo: 'crm',
  nombre: 'CRM',
  descripcion: 'Clientes potenciales, seguimiento y oportunidades de venta.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['crm:ver', 'crm:editar', 'crm:configurar'],
  permisosPorNivel: {
    completo: ['crm:ver', 'crm:editar', 'crm:configurar'],
    lectura: ['crm:ver'],
  },
  secciones: [
    { id: 'tablero', nombre: 'Tablero', ruta: '/m/crm', construida: true },
    { id: 'lista', nombre: 'Oportunidades', ruta: '/m/crm/lista', construida: true },
    { id: 'actividades', nombre: 'Actividades', ruta: '/m/crm/actividades', construida: true },
    { id: 'ajustes', nombre: 'Etapas', ruta: '/m/crm/ajustes', construida: true },
  ],
  familia: 'ventas',
  orden: 1,
  acento: 'cian',
  icono: 'crm',
};
