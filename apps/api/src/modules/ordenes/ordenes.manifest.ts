import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoOrdenes: ManifiestoDeEntrada = {
  codigo: 'ordenes',
  nombre: 'Pedidos',
  descripcion: 'Pedidos de clientes, de la aceptación a la entrega.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['ordenes:ver', 'ordenes:editar'],
  permisosPorNivel: {
    completo: ['ordenes:ver', 'ordenes:editar'],
    lectura: ['ordenes:ver'],
  },
  secciones: [],
  familia: 'ventas',
  orden: 2,
  acento: 'esmeralda',
  icono: 'ordenes',
  enConstruccion: true,
};
