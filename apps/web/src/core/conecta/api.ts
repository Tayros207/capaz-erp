import type { EntradaDe, Respuesta } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

export const POR_PAGINA = 25;

/** Error de una llamada rechazada; las consultas con caché necesitan una excepción. */
export class ErrorDeApi extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

/** Los datos de una respuesta correcta, o una excepción con el mensaje del servidor. */
export function datosOError<S>(r: Respuesta<S>): S {
  if (r.ok && 'datos' in r) return r.datos;
  if ('error' in r) throw new ErrorDeApi(r.error.codigo, r.error.mensaje);
  throw new ErrorDeApi('requiere_confirmacion', 'La operación pide una confirmación que esta pantalla no maneja.');
}

// ---- Conectores y conexiones ----
export const listarConectores = () => llamar('conectores_listar', {});
export const verConexion = (conector: string) => llamar('conexion_ver', { conector });
export const desactivarConexion = (conector: string) => llamar('conexion_desactivar', { conector });
// Crítica: el servidor pide confirmar y la persona ve el resumen antes de que cambie nada.
export const configurarConexion = (args: EntradaDe<'conexion_configurar'>) =>
  llamarConfirmando('conexion_configurar', args, { titulo: 'Configurar la conexión', textoConfirmar: 'Guardar conexión' });

// ---- Claves de API ----
export const listarClavesApi = () => llamar('claves_api_listar', {});
export const crearClaveApi = (nombre: string) => llamar('clave_api_crear', { nombre, alcance: ['entrada'] });
export const revocarClaveApi = (id: string) =>
  llamarConfirmando('clave_api_revocar', { id }, { titulo: 'Revocar la clave', textoConfirmar: 'Revocar', peligroso: true });

// ---- Webhooks de salida ----
export function listarWebhooks(cursor?: string) {
  const args: EntradaDe<'webhooks_salientes_listar'> = { limite: POR_PAGINA };
  if (cursor) args.cursor = cursor;
  return llamar('webhooks_salientes_listar', args);
}
export const crearWebhook = (args: EntradaDe<'webhooks_salientes_crear'>) => llamar('webhooks_salientes_crear', args);
export const editarWebhook = (args: EntradaDe<'webhooks_salientes_editar'>) => llamar('webhooks_salientes_editar', args);
export const archivarWebhook = (id: string) => llamar('webhooks_salientes_archivar', { id });

export function listarEnvios(filtro: { webhookId?: string; estado?: 'pendiente' | 'enviado' | 'fallido' }, cursor?: string) {
  const args: EntradaDe<'webhook_envios_listar'> = { limite: POR_PAGINA };
  if (filtro.webhookId) args.webhookId = filtro.webhookId;
  if (filtro.estado) args.estado = filtro.estado;
  if (cursor) args.cursor = cursor;
  return llamar('webhook_envios_listar', args);
}
export const reintentarEnvio = (id: string) => llamar('webhook_envio_reintentar', { id });

// ---- Importar y exportar CSV ----
export const exportarCsv = (args: EntradaDe<'exportar_csv'>) => llamar('exportar_csv', args);
export const previsualizarCsv = (args: EntradaDe<'importar_csv_previsualizar'>) => llamar('importar_csv_previsualizar', args);
export const aplicarCsv = (args: EntradaDe<'importar_csv_aplicar'>) =>
  llamarConfirmando('importar_csv_aplicar', args, { titulo: 'Aplicar la importación', textoConfirmar: 'Importar' });
