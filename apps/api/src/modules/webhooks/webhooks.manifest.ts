import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoWebhooks: ManifiestoDeEntrada = {
  codigo: 'webhooks',
  nombre: 'Webhooks y claves',
  descripcion:
    'Avisos hacia otros sistemas y claves de acceso para conectarlos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['webhooks:ver', 'webhooks:editar'],
  permisosPorNivel: {
    completo: ['webhooks:ver', 'webhooks:editar'],
    lectura: ['webhooks:ver'],
  },
  secciones: [],
  familia: 'conexiones',
  orden: 1,
  acento: 'gris',
  icono: 'webhooks',
  enConstruccion: true,
};
