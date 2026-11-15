import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fase 11a: conectores, conexiones, sincronizaciones, claves de API y webhooks (ADR-014; §6.4, 0010).
// Seguridad (aislamiento, permisos por columna de capaz_sistema) a mano en la migración.

/** Catálogo de conectores (sin `tenant_id`). Se sincroniza al arrancar. */
export const conectores = core.table(
  'conectores',
  {
    codigo: text('codigo').primaryKey(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    version: text('version').notNull().default('0.0.0'),
    capacidades: text('capacidades').array().notNull().default(sql`'{}'::text[]`),
    autenticacion: text('autenticacion').notNull(),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('conector_autenticacion', sql`${t.autenticacion} IN ('clave_api', 'oauth2', 'ninguna')`)],
);

/** Conexión de una empresa a un conector. Las credenciales cifradas NUNCA se exponen a `capaz_sistema`. */
export const conexiones = core.table(
  'conexiones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    conector: text('conector').notNull().references(() => conectores.codigo),
    estado: text('estado').notNull().default('pendiente'),
    configuracion: jsonb('configuracion').notNull().default(sql`'{}'::jsonb`),
    credencialesCifradas: text('credenciales_cifradas'),
    claveVersion: smallint('clave_version'),
    ultimoError: text('ultimo_error'),
    ultimoUsoEn: timestamp('ultimo_uso_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('conexiones_empresa_id').on(t.tenantId, t.id),
    unique('conexiones_empresa_conector').on(t.tenantId, t.conector),
    check('conexion_estado', sql`${t.estado} IN ('pendiente', 'activa', 'con_error', 'desactivada')`),
  ],
);

/** Correspondencia entre ids internos y ids de un sistema externo. */
export const referenciasExternas = core.table(
  'referencias_externas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    conector: text('conector').notNull(),
    entidad: text('entidad').notNull(),
    idInterno: text('id_interno').notNull(),
    idExterno: text('id_externo').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_referencias_externas').on(t.tenantId, t.conector, t.entidad, t.idExterno),
    index('idx_referencias_internas').on(t.tenantId, t.conector, t.entidad, t.idInterno),
  ],
);

/** Corridas de importación, exportación y sincronización (`archivo` = CSV). */
export const sincronizaciones = core.table(
  'sincronizaciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    conector: text('conector').notNull(),
    conexionId: uuid('conexion_id'),
    tipo: text('tipo').notNull(),
    entidad: text('entidad').notNull(),
    estado: text('estado').notNull().default('en_curso'),
    cursor: text('cursor'),
    total: integer('total'),
    procesados: integer('procesados').notNull().default(0),
    errores: jsonb('errores').notNull().default(sql`'[]'::jsonb`),
    iniciadoPor: text('iniciado_por').notNull(),
    iniciadoEn: timestamp('iniciado_en', { withTimezone: true }).notNull().defaultNow(),
    terminadoEn: timestamp('terminado_en', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'sincronizaciones_conexion_fk',
      columns: [t.tenantId, t.conexionId],
      foreignColumns: [conexiones.tenantId, conexiones.id],
    }),
    check('sincronizacion_tipo', sql`${t.tipo} IN ('importar', 'exportar', 'sincronizar')`),
    check('sincronizacion_estado', sql`${t.estado} IN ('en_curso', 'ok', 'con_errores', 'fallida')`),
    index('idx_sincronizaciones_inicio').on(t.tenantId, t.iniciadoEn.desc()),
  ],
);

/** Claves de API. La clave primaria es el hash (SHA-256): buscar entre empresas no necesita índice sin `tenant_id`. */
export const clavesApi = core.table(
  'claves_api',
  {
    hash: text('hash').primaryKey(),
    id: uuid('id').notNull().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    prefijo: text('prefijo').notNull(),
    alcance: text('alcance').array().notNull().default(sql`'{}'::text[]`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    ultimoUsoEn: timestamp('ultimo_uso_en', { withTimezone: true }),
    revocadaEn: timestamp('revocada_en', { withTimezone: true }),
  },
  (t) => [unique('claves_api_empresa_id').on(t.tenantId, t.id)],
);

/** Webhooks recibidos (idempotentes por clave de API y clave de idempotencia). */
export const webhooksEntrantes = core.table(
  'webhooks_entrantes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    claveApiId: uuid('clave_api_id').notNull(),
    evento: text('evento').notNull(),
    claveIdempotencia: text('clave_idempotencia').notNull(),
    carga: jsonb('carga').notNull(),
    recibidoEn: timestamp('recibido_en', { withTimezone: true }).notNull().defaultNow(),
    procesadoEn: timestamp('procesado_en', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [
    foreignKey({
      name: 'webhooks_entrantes_clave_fk',
      columns: [t.tenantId, t.claveApiId],
      foreignColumns: [clavesApi.tenantId, clavesApi.id],
    }),
    uniqueIndex('uq_webhooks_entrantes_idempotencia').on(t.tenantId, t.claveApiId, t.claveIdempotencia),
    index('idx_webhooks_entrantes_recibido').on(t.tenantId, t.recibidoEn.desc()),
  ],
);

/** Webhooks que la empresa configura para recibir sus eventos. */
export const webhooksSalientes = core.table(
  'webhooks_salientes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    url: text('url').notNull(),
    eventos: text('eventos').array().notNull(),
    secretoCifrado: text('secreto_cifrado').notNull(),
    claveVersion: smallint('clave_version').notNull(),
    activo: boolean('activo').notNull().default(true),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
    ultimoEnvioEn: timestamp('ultimo_envio_en', { withTimezone: true }),
    ultimoError: text('ultimo_error'),
  },
  (t) => [unique('webhooks_salientes_empresa_id').on(t.tenantId, t.id)],
);

/** Un envío por webhook y evento. `evento_id` sin llave foránea: la bandeja de eventos se purga. */
export const webhooksEnvios = core.table(
  'webhooks_envios',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    webhookId: uuid('webhook_id').notNull(),
    eventoId: uuid('evento_id').notNull(),
    tipo: text('tipo').notNull(),
    estado: text('estado').notNull().default('pendiente'),
    intentos: integer('intentos').notNull().default(0),
    codigoHttp: integer('codigo_http'),
    ultimoError: text('ultimo_error'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    enviadoEn: timestamp('enviado_en', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'webhooks_envios_webhook_fk',
      columns: [t.tenantId, t.webhookId],
      foreignColumns: [webhooksSalientes.tenantId, webhooksSalientes.id],
    }),
    check('webhook_envio_estado', sql`${t.estado} IN ('pendiente', 'enviado', 'fallido')`),
    uniqueIndex('uq_webhooks_envios_evento').on(t.tenantId, t.webhookId, t.eventoId),
    index('idx_webhooks_envios_estado').on(t.tenantId, t.estado, t.creadoEn.desc()),
  ],
);

