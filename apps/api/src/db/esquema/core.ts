import { sql } from 'drizzle-orm';
import { bigint, check, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

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
  razonSocial: text('razon_social'),
  ruc: text('ruc'),
  direccionFiscal: text('direccion_fiscal'),
  telefono: text('telefono'),
  correo: text('correo'),
  pieDeDocumento: text('pie_de_documento'),
  logoDataUrl: text('logo_data_url'),
  montoMinimoCentimos: bigint('monto_minimo_centimos', { mode: 'number' }),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('empresa_config_ruc', sql`${t.ruc} is null or ${t.ruc} ~ '^[0-9]{11}$'`),
  check('empresa_config_razon_social_largo', sql`${t.razonSocial} is null or length(${t.razonSocial}) <= 200`),
  check('empresa_config_direccion_largo', sql`${t.direccionFiscal} is null or length(${t.direccionFiscal}) <= 300`),
  check('empresa_config_telefono_largo', sql`${t.telefono} is null or length(${t.telefono}) <= 50`),
  check('empresa_config_correo_largo', sql`${t.correo} is null or length(${t.correo}) <= 200`),
  check('empresa_config_pie_largo', sql`${t.pieDeDocumento} is null or length(${t.pieDeDocumento}) <= 1000`),
  check('empresa_config_logo_largo', sql`${t.logoDataUrl} is null or length(${t.logoDataUrl}) <= 150000`),
  check('empresa_config_monto_minimo', sql`${t.montoMinimoCentimos} is null or ${t.montoMinimoCentimos} between 0 and 10000000`),
  check('empresa_config_logo_formato', sql`${t.logoDataUrl} is null or ${t.logoDataUrl} ~ '^data:image/(png|jpeg|webp);base64,'`),
]);
