import { pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

// Esquema `core`: lo que todos los módulos comparten (empresa, módulos, permisos, clientes…).
// RLS, permisos y funciones NO se declaran aquí: van en SQL a mano en cada migración
// (`select core.aplicar_aislamiento('core.tabla')`), porque drizzle-kit no genera FORCE ni GRANT.

export const core = pgSchema('core');

/** Configuración por empresa. `tenant_id` es el id de organización de Better Auth (ADR-012). */
export const empresaConfig = core.table('empresa_config', {
  tenantId: text('tenant_id').primaryKey(),
  zonaHoraria: text('zona_horaria').notNull().default('America/Lima'),
  moneda: text('moneda').notNull().default('PEN'),
  locale: text('locale').notNull().default('es-PE'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});
