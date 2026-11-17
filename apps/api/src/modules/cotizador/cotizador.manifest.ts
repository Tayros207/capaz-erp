import type { ManifiestoDeEntrada } from '@capaz/shared';

// Cotizador (B1): lista de precios por cantidad, ajuste por cliente, configuración y cotizaciones.
export const manifiestoCotizador: ManifiestoDeEntrada = {
  codigo: 'cotizador',
  nombre: 'Cotizador',
  descripcion: 'Lista de precios por cantidad y cotizaciones que se convierten en pedidos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['cotizador:ver', 'cotizador:editar', 'cotizador:emitir', 'cotizador:costos', 'cotizador:configurar'],
  permisosPorNivel: {
    completo: ['cotizador:ver', 'cotizador:editar', 'cotizador:emitir', 'cotizador:costos', 'cotizador:configurar'],
    lectura: ['cotizador:ver'],
  },
  secciones: [
    { id: 'rapida', nombre: 'Cotización rápida', ruta: '/m/cotizador', construida: false },
    { id: 'cotizaciones', nombre: 'Cotizaciones', ruta: '/m/cotizador/cotizaciones', construida: false },
    { id: 'precios', nombre: 'Lista de precios', ruta: '/m/cotizador/precios', construida: false },
    { id: 'ajustes', nombre: 'Ajustes', ruta: '/m/cotizador/ajustes', construida: false },
  ],
  familia: 'ventas',
  orden: 3,
  acento: 'cian',
  icono: 'cotizador',
  enConstruccion: true,
};
