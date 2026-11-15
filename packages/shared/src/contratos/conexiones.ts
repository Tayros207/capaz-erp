import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «conexiones»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
//
// Ninguna salida lleva credenciales: la pantalla solo sabe «configurada». Las únicas excepciones son los
// secretos que se muestran UNA vez al crearlos (`clave_api_crear` y `webhooks_salientes_crear`).

export const ESTADOS_DE_CONEXION = ['pendiente', 'activa', 'con_error', 'desactivada'] as const;
export const ESTADOS_DE_ENVIO = ['pendiente', 'enviado', 'fallido'] as const;
/** Lo que una clave de API puede hacer. Hoy solo entregar webhooks de entrada. */
export const ALCANCES_DE_CLAVE = ['entrada'] as const;
export const MAX_EVENTOS_POR_WEBHOOK = 20;

const idSchema = z.uuid({ error: 'El identificador no es válido.' });
const codigoDeConector = z.string().trim().min(1).max(60);
const fecha = z.iso.datetime();

// ---- Conectores y conexiones ----------------------------------------------------------------

export const conectorSchema = z.strictObject({
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  version: z.string(),
  capacidades: z.array(z.string()),
  autenticacion: z.enum(['clave_api', 'oauth2', 'ninguna']),
  /** La empresa puede usarlo (módulo vigente). */
  moduloActivo: z.boolean(),
  /** `null` si la empresa aún no creó la conexión. */
  estado: z.enum(ESTADOS_DE_CONEXION).nullable(),
});
export type Conector = z.infer<typeof conectorSchema>;

export const conexionSchema = z.strictObject({
  id: z.string(),
  conector: z.string(),
  estado: z.enum(ESTADOS_DE_CONEXION),
  /** Lo no secreto. */
  configuracion: z.record(z.string(), z.unknown()),
  /** Solo «hay credenciales o no»: nunca su valor. */
  credencialesConfiguradas: z.boolean(),
  ultimoError: z.string().nullable(),
  ultimoUsoEn: fecha.nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type Conexion = z.infer<typeof conexionSchema>;

export const conectoresListarSchema = z.strictObject({});
export const conexionVerSchema = z.strictObject({ conector: codigoDeConector });
export const conexionConfigurarSchema = z.strictObject({
  conector: codigoDeConector,
  /** Se valida con el esquema del conector. */
  configuracion: z.record(z.string(), z.unknown()).default({}),
  /** Se valida con el esquema del conector, se cifra y nunca vuelve a salir. */
  credenciales: z.record(z.string(), z.unknown()).optional(),
});

// ---- Claves de API --------------------------------------------------------------------------

export const claveApiSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  /** Los primeros caracteres, para reconocerla en la lista. */
  prefijo: z.string(),
  alcance: z.array(z.enum(ALCANCES_DE_CLAVE)),
  creadoPor: z.string(),
  creadoEn: fecha,
  ultimoUsoEn: fecha.nullable(),
  revocadaEn: fecha.nullable(),
});
export type ClaveApi = z.infer<typeof claveApiSchema>;

export const claveApiCreadaSchema = z.strictObject({
  ...claveApiSchema.shape,
  /** La clave completa: se muestra esta única vez; en la base solo queda su hash. */
  clave: z.string(),
});

export const clavesApiListarSchema = z.strictObject({});
export const claveApiCrearSchema = z.strictObject({
  nombre: z.string().trim().min(1, { error: 'Ponle un nombre a la clave.' }).max(80),
  alcance: z.array(z.enum(ALCANCES_DE_CLAVE)).min(1).max(ALCANCES_DE_CLAVE.length).default(['entrada']),
});
export const claveApiRevocarSchema = z.strictObject({ id: idSchema });

// ---- Webhooks de salida ---------------------------------------------------------------------

/** Un evento exacto (`cliente.creado`), una familia (`cliente.*`) o todo (`*`). */
const eventoSuscrito = z.string().trim().regex(/^(\*|[a-z][a-z0-9_]*\.(\*|[a-z][a-z0-9_]*))$/, { error: 'Escribe un evento como «cliente.creado», una familia como «cliente.*» o «*».' });

export const webhookSalienteSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  url: z.string(),
  eventos: z.array(z.string()),
  activo: z.boolean(),
  ultimoEnvioEn: fecha.nullable(),
  ultimoError: z.string().nullable(),
  creadoEn: fecha,
  actualizadoEn: fecha,
});
export type WebhookSaliente = z.infer<typeof webhookSalienteSchema>;

/** `secreto` solo viene al crearlo o al rotarlo: sirve para verificar la firma de cada envío. */
export const webhookSalienteConSecretoSchema = z.strictObject({ ...webhookSalienteSchema.shape, secreto: z.string().optional() });

export const webhooksSalientesListarSchema = z.strictObject({ ...paginaSchema.shape, activo: z.boolean().optional() });
export const webhookSalienteCrearSchema = z.strictObject({
  nombre: z.string().trim().min(1, { error: 'Ponle un nombre al webhook.' }).max(80),
  url: z.string().trim().min(1).max(2000),
  eventos: z.array(eventoSuscrito).min(1, { error: 'Elige al menos un evento.' }).max(MAX_EVENTOS_POR_WEBHOOK),
});
export const webhookSalienteEditarSchema = z.strictObject({
  id: idSchema,
  nombre: z.string().trim().min(1).max(80).optional(),
  url: z.string().trim().min(1).max(2000).optional(),
  eventos: z.array(eventoSuscrito).min(1).max(MAX_EVENTOS_POR_WEBHOOK).optional(),
  activo: z.boolean().optional(),
  /** Genera un secreto nuevo y lo muestra una vez. */
  rotarSecreto: z.boolean().optional(),
});
export const webhookSalienteArchivarSchema = z.strictObject({ id: idSchema });

export const webhookEnvioSchema = z.strictObject({
  id: z.string(),
  webhookId: z.string(),
  eventoId: z.string(),
  tipo: z.string(),
  estado: z.enum(ESTADOS_DE_ENVIO),
  intentos: z.number().int(),
  codigoHttp: z.number().int().nullable(),
  ultimoError: z.string().nullable(),
  creadoEn: fecha,
  enviadoEn: fecha.nullable(),
});
export type WebhookEnvio = z.infer<typeof webhookEnvioSchema>;

export const webhookEnviosListarSchema = z.strictObject({
  ...paginaSchema.shape,
  webhookId: idSchema.optional(),
  estado: z.enum(ESTADOS_DE_ENVIO).optional(),
});
export const webhookEnvioReintentarSchema = z.strictObject({ id: idSchema });

export const contratosDeConexiones = {
  conectores_listar: contrato(conectoresListarSchema, z.strictObject({ items: z.array(conectorSchema) })),
  conexion_ver: contrato(conexionVerSchema, conexionSchema),
  conexion_configurar: contrato(conexionConfigurarSchema, conexionSchema),
  conexion_desactivar: contrato(conexionVerSchema, conexionSchema),
  claves_api_listar: contrato(clavesApiListarSchema, z.strictObject({ items: z.array(claveApiSchema) })),
  clave_api_crear: contrato(claveApiCrearSchema, claveApiCreadaSchema),
  clave_api_revocar: contrato(claveApiRevocarSchema, claveApiSchema),
  webhooks_salientes_listar: contrato(webhooksSalientesListarSchema, listadoSchema(webhookSalienteSchema)),
  webhooks_salientes_crear: contrato(webhookSalienteCrearSchema, webhookSalienteConSecretoSchema),
  webhooks_salientes_editar: contrato(webhookSalienteEditarSchema, webhookSalienteConSecretoSchema),
  webhooks_salientes_archivar: contrato(webhookSalienteArchivarSchema, webhookSalienteSchema),
  webhook_envios_listar: contrato(webhookEnviosListarSchema, listadoSchema(webhookEnvioSchema)),
  webhook_envio_reintentar: contrato(webhookEnvioReintentarSchema, webhookEnvioSchema),
} as const;

/**
 * Llegó un webhook de entrada ya autenticado y guardado. `evento` es el nombre que puso quien lo envió
 * (la reglas de automatización de tipo `webhook` lo comparan con `carga.evento`); `carga` es su contenido.
 */
export const webhookRecibidoSchema = z.strictObject({
  evento: z.string(),
  entradaId: z.string(),
  carga: z.record(z.string(), z.unknown()),
});

export const eventosDeConexiones = {
  'webhook.recibido': webhookRecibidoSchema,
} as const;
