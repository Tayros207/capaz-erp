import type { ManifiestoDeEntrada } from '@capaz/shared';

// Cotizador por pliego (portado de Cotizín en su propia fase). Por ahora solo el manifiesto.
export const manifiestoCotizador: ManifiestoDeEntrada = {
  codigo: 'cotizador',
  nombre: 'Cotizador',
  descripcion: 'Cotizaciones de trabajos de imprenta con enlace para el cliente y PDF.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['cotizador:ver', 'cotizador:editar', 'cotizador:emitir', 'cotizador:costos'],
  permisosPorNivel: {
    completo: ['cotizador:ver', 'cotizador:editar', 'cotizador:emitir', 'cotizador:costos'],
    lectura: ['cotizador:ver'],
  },
  secciones: [],
  familia: 'ventas',
  orden: 3,
  acento: 'cian',
  icono: 'cotizador',
  enConstruccion: true,
};
