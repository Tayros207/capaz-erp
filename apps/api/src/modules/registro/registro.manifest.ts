import type { ManifiestoDeEntrada } from '@capaz/shared';

// Finanzas ligeras (fase 14): caja, movimientos, cuentas por cobrar y por pagar, abonos.
// La captura es tecleada; la voz llegará sobre estas mismas herramientas.
export const manifiestoRegistro: ManifiestoDeEntrada = {
  codigo: 'registro',
  nombre: 'Registro',
  descripcion: 'Caja, ingresos, egresos y cuentas por cobrar y por pagar.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['registro:ver', 'registro:editar', 'registro:anular', 'registro:configurar', 'registro:reportes'],
  permisosPorNivel: {
    completo: ['registro:ver', 'registro:editar', 'registro:anular', 'registro:configurar', 'registro:reportes'],
    lectura: ['registro:ver', 'registro:reportes'],
  },
  secciones: [
    { id: 'movimientos', nombre: 'Movimientos', ruta: '/m/registro/movimientos', construida: true },
    { id: 'por-cobrar', nombre: 'Por cobrar', ruta: '/m/registro/por-cobrar', construida: true },
    { id: 'por-pagar', nombre: 'Por pagar', ruta: '/m/registro/por-pagar', construida: true },
    { id: 'caja', nombre: 'Caja del día', ruta: '/m/registro/caja', construida: true },
    { id: 'cierre', nombre: 'Cierre semanal', ruta: '/m/registro/cierre', construida: true },
    { id: 'antiguedad', nombre: 'Antigüedad', ruta: '/m/registro/antiguedad', construida: true },
    { id: 'papelera', nombre: 'Papelera', ruta: '/m/registro/papelera', construida: true },
    { id: 'ajustes', nombre: 'Cuentas y categorías', ruta: '/m/registro/ajustes', construida: true },
  ],
  familia: 'finanzas',
  orden: 1,
  acento: 'esmeralda',
  icono: 'registro',
  // Decisión comercial provisional, editable como dato: toda empresa nueva recibe 30 días de prueba.
  porDefecto: { pruebaDias: 30 },
};
