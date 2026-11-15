import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoCompras: ManifiestoDeEntrada = {
  codigo: 'compras',
  nombre: 'Compras',
  descripcion: 'Pedidos a proveedores y recepción de lo comprado.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['compras:ver', 'compras:editar'],
  permisosPorNivel: {
    completo: ['compras:ver', 'compras:editar'],
    lectura: ['compras:ver'],
  },
  secciones: [],
  familia: 'compras',
  orden: 1,
  acento: 'ambar',
  icono: 'compras',
  enConstruccion: true,
};
