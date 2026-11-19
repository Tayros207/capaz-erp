import type { ManifiestoDeEntrada } from '@capaz/shared';

// Pedidos de clientes con líneas, de borrador a entregado (FICHAS-OLA-2 §6).
export const manifiestoOrdenes: ManifiestoDeEntrada = {
  codigo: 'ordenes',
  nombre: 'Pedidos',
  descripcion: 'Pedidos de clientes, de la aceptación a la entrega.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['ordenes:ver', 'ordenes:editar', 'ordenes:cancelar'],
  permisosPorNivel: {
    completo: ['ordenes:ver', 'ordenes:editar', 'ordenes:cancelar'],
    lectura: ['ordenes:ver'],
  },
  secciones: [
    { id: 'lista', nombre: 'Pedidos', ruta: '/m/ordenes', construida: true },
    { id: 'tablero', nombre: 'Por estado', ruta: '/m/ordenes/tablero', construida: true },
    { id: 'entregas', nombre: 'Entregas', ruta: '/m/ordenes/entregas', construida: true },
    { id: 'guias', nombre: 'Guías de remisión', ruta: '/m/ordenes/guias', construida: true },
  ],
  familia: 'ventas',
  orden: 2,
  acento: 'esmeralda',
  icono: 'ordenes',
};
