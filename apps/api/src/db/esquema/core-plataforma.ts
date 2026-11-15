import { sql } from 'drizzle-orm';
import { check, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fase 9a: consola de plataforma (§6.4, 0009). No es de ninguna empresa: sin `tenant_id`.
// Seguridad (solo inserción, permisos de capaz_sistema, vista de empresas) a mano en la migración.

/** Auditoría de lo que hace el operador de la plataforma. Solo inserción; solo `capaz_sistema`. */
export const auditoriaPlataforma = core.table(
  'auditoria_plataforma',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    actorUsuarioId: text('actor_usuario_id').notNull(),
    herramienta: text('herramienta').notNull(),
    empresaId: text('empresa_id'),
    resultado: text('resultado').notNull(),
    codigo: text('codigo'),
    resumen: jsonb('resumen').notNull().default(sql`'{}'::jsonb`),
    requestId: text('request_id').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('auditoria_plataforma_resultado', sql`${t.resultado} IN ('ok', 'rechazada')`),
  ],
);
