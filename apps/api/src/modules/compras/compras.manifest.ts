import type { ManifiestoDeEntrada } from '@capaz/shared';

// Órdenes de compra a proveedores, recepción total o parcial y cancelación (FICHAS-OLA-3 §3), solicitudes de compra con
// aprobación y facturas del proveedor conciliadas (0026).
// Exige Inventario contratado (P3-6); las líneas admiten productos sin artículo de inventario.
export const manifiestoCompras: ManifiestoDeEntrada = {
  codigo: 'compras',
  nombre: 'Compras',
  descripcion: 'Órdenes de compra a proveedores y recepción de lo comprado.',
  version: '0.1.0',
  dependeDe: ['insumos'],
  permisos: ['compras:ver', 'compras:editar', 'compras:cancelar', 'compras:aprobar'],
  permisosPorNivel: {
    completo: ['compras:ver', 'compras:editar', 'compras:cancelar', 'compras:aprobar'],
    lectura: ['compras:ver'],
  },
  secciones: [
    { id: 'lista', nombre: 'Órdenes de compra', ruta: '/m/compras', construida: true },
    { id: 'solicitudes', nombre: 'Solicitudes', ruta: '/m/compras/solicitudes', construida: true },
    { id: 'facturas', nombre: 'Facturas', ruta: '/m/compras/facturas', construida: true },
    { id: 'costos', nombre: 'Costos por artículo', ruta: '/m/compras/costos', construida: true },
  ],
  familia: 'compras',
  orden: 1,
  acento: 'ambar',
  icono: 'compras',
};
