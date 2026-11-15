import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fase 5a: auditoría de herramientas, confirmaciones usadas e idempotencia (PLAN-DE-CONSTRUCCION §6.4, 0006).
// Seguridad (aislamiento, disparadores, permisos de plataforma) a mano en la migración.

/** Registro de cada operación de negocio. Solo inserción; sin llaves foráneas (particionable). */
export const auditoria = core.table(
  'auditoria',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    modulo: text('modulo').notNull(),
    herramienta: text('herramienta').notNull(),
    canal: text('canal').notNull(),
    resultado: text('resultado').notNull(),
    codigo: text('codigo'),
    hashArgs: text('hash_args').notNull(),
    entidadTipo: text('entidad_tipo'),
    entidadId: text('entidad_id'),
    resumen: jsonb('resumen').notNull().default(sql`'{}'::jsonb`),
    requestId: text('request_id').notNull(),
    duracionMs: integer('duracion_ms').notNull().default(0),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('auditoria_canal', sql`${t.canal} IN ('ui', 'agente', 'mcp', 'sistema')`),
    check('auditoria_resultado', sql`${t.resultado} IN ('ok', 'rechazada', 'pendiente_confirmacion')`),
    index('idx_auditoria_empresa').on(t.tenantId, t.creadoEn.desc()),
    index('idx_auditoria_entidad').on(t.tenantId, t.entidadTipo, t.entidadId, t.creadoEn.desc()),
  ],
);

/** Confirmaciones (jti) ya consumidas: una confirmación sirve una sola vez. */
export const confirmacionesUsadas = core.table(
  'confirmaciones_usadas',
  {
    tenantId: text('tenant_id').notNull(),
    jti: text('jti').notNull(),
    usadoEn: timestamp('usado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.jti] })],
);

/** Idempotencia de herramientas. `respuesta` nula = la primera petición sigue en curso. */
export const idempotencia = core.table(
  'idempotencia',
  {
    tenantId: text('tenant_id').notNull(),
    clave: text('clave').notNull(),
    herramienta: text('herramienta').notNull(),
    hashArgs: text('hash_args').notNull(),
    respuesta: jsonb('respuesta'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.clave] })],
);
