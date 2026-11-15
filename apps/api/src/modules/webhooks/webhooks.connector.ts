import type { ManifiestoDeConector } from '@capaz/shared';
import { z } from 'zod';

/** El conector `webhooks`: avisos de salida firmados y entrada con clave de API. No guarda credenciales por conexión. */
export const conectorWebhooks: ManifiestoDeConector = {
  codigo: 'webhooks',
  nombre: 'Webhooks y claves',
  descripcion: 'Avisa a otros sistemas cuando pasa algo y recibe avisos de ellos con una clave de API.',
  version: '1.0.0',
  capacidades: ['enviar_eventos', 'recibir_eventos'],
  autenticacion: 'ninguna',
  configuracion: z.strictObject({}),
  credenciales: z.strictObject({}),
  herramientas: [
    'webhooks_salientes_listar',
    'webhooks_salientes_crear',
    'webhooks_salientes_editar',
    'webhooks_salientes_archivar',
    'webhook_envios_listar',
    'webhook_envio_reintentar',
    'claves_api_listar',
    'clave_api_crear',
    'clave_api_revocar',
  ],
  escucha: ['*'],
  emite: ['webhook.recibido'],
};
