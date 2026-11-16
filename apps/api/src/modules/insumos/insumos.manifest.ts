import type { ManifiestoDeEntrada } from '@capaz/shared';

// Inventario (FICHAS-OLA-3 §2): artículos bajo control, existencias por sucursal, entradas, salidas y ajustes.
// La captura es tecleada; la voz llegará sobre estas mismas herramientas.
export const manifiestoInsumos: ManifiestoDeEntrada = {
  codigo: 'insumos',
  nombre: 'Inventario',
  descripcion: 'Existencias de insumos y productos, con sus movimientos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['insumos:ver', 'insumos:editar', 'insumos:ajustar'],
  permisosPorNivel: {
    completo: ['insumos:ver', 'insumos:editar', 'insumos:ajustar'],
    lectura: ['insumos:ver'],
  },
  secciones: [
    { id: 'existencias', nombre: 'Existencias', ruta: '/m/insumos', construida: true },
    { id: 'alertas', nombre: 'Bajo mínimo', ruta: '/m/insumos/alertas', construida: true },
    { id: 'movimientos', nombre: 'Movimientos', ruta: '/m/insumos/movimientos', construida: true },
  ],
  familia: 'inventario',
  orden: 1,
  acento: 'esmeralda',
  icono: 'insumos',
};
