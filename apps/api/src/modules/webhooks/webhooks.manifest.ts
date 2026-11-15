import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo de la familia «conexiones» con su conector (`webhooks.connector.ts`). Sus herramientas usan los permisos
// `conexiones:*` del núcleo.
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
  // Se quita junto con el ajuste de `catalogo.spec.ts` (ya no son nueve en construcción): ver informe del carril S7.
  enConstruccion: true,
};
