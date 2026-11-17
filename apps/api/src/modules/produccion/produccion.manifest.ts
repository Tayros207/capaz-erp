import type { ManifiestoDeEntrada } from '@capaz/shared';

// Órdenes de trabajo del taller (modelo de SF): cliente, líneas con cantidad y valor, adelanto y lo que falta cancelar, con su
// avance pendiente → en máquina → listo → entregado.
// El cobro real vive en Finanzas (registro): este módulo emite eventos y Finanzas propone la deuda con su adelanto.
export const manifiestoProduccion: ManifiestoDeEntrada = {
  codigo: 'produccion',
  nombre: 'Producción',
  descripcion: 'Órdenes de trabajo del taller con su adelanto y lo que falta cancelar.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['produccion:ver', 'produccion:editar', 'produccion:anular'],
  permisosPorNivel: {
    completo: ['produccion:ver', 'produccion:editar', 'produccion:anular'],
    lectura: ['produccion:ver'],
  },
  secciones: [{ id: 'ordenes', nombre: 'Órdenes de trabajo', ruta: '/m/produccion', construida: true }],
  familia: 'produccion',
  orden: 1,
  acento: 'cian',
  icono: 'produccion',
};
