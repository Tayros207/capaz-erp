import { sql } from 'drizzle-orm';
import { bigint, index, integer, jsonb, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fase 8: bandeja de eventos de salida, eventos ya procesados y correlativos (§6.4, 0007).

/** Bandeja de salida (patrón outbox). La plataforma relevo NO puede leer `carga` (permisos por columna). */
export const eventosSalida = core.table(
  'eventos_salida',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    tipo: text('tipo').notNull(),
    carga: jsonb('carga').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    disponibleEn: timestamp('disponible_en', { withTimezone: true }).notNull().defaultNow(),
    procesadoEn: timestamp('procesado_en', { withTimezone: true }),
    intentos: integer('intentos').notNull().default(0),
    ultimoError: text('ultimo_error'),
    fallidoEn: timestamp('fallido_en', { withTimezone: true }),
  },
  (t) => [
    index('idx_eventos_salida_pendientes')
      .on(t.tenantId, t.disponibleEn)
      .where(sql`${t.procesadoEn} is null and ${t.fallidoEn} is null`),
  ],
);

/** Qué consumidor ya procesó qué evento (idempotencia de consumidores). */
export const eventosProcesados = core.table(
  'eventos_procesados',
  {
    tenantId: text('tenant_id').notNull(),
    eventoId: uuid('evento_id').notNull(),
    consumidor: text('consumidor').notNull(),
    procesadoEn: timestamp('procesado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.eventoId, t.consumidor] })],
);

/** Correlativos por empresa, clave, serie y año. */
export const contadores = core.table(
  'contadores',
  {
    tenantId: text('tenant_id').notNull(),
    clave: text('clave').notNull(),
    serie: text('serie').notNull().default(''),
    anio: integer('anio').notNull(),
    ultimo: bigint('ultimo', { mode: 'number' }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.clave, t.serie, t.anio] })],
);
