import { sql } from 'drizzle-orm';
import { boolean, check, foreignKey, index, integer, jsonb, primaryKey, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fases 13 y 11a: bandeja de borradores y reglas automáticas (§6.4, 0011).
// Seguridad (aislamiento, permisos de capaz_sistema) a mano en la migración.

/** Bandeja de borradores del trabajador digital. El código nunca borra: aprueba o descarta. */
export const borradores = core.table(
  'borradores',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    herramienta: text('herramienta').notNull(),
    modulo: text('modulo').notNull(),
    args: jsonb('args').notNull(),
    argsOriginales: jsonb('args_originales').notNull(),
    resumen: text('resumen').notNull(),
    origen: text('origen').notNull(),
    origenRef: text('origen_ref'),
    prioridad: text('prioridad').notNull().default('normal'),
    estado: text('estado').notNull().default('pendiente'),
    corregido: boolean('corregido').notNull().default(false),
    propuestoPor: text('propuesto_por').notNull(),
    propuestoEn: timestamp('propuesto_en', { withTimezone: true }).notNull().defaultNow(),
    capturaIniciadaEn: timestamp('captura_iniciada_en', { withTimezone: true }),
    resueltoPor: text('resuelto_por'),
    resueltoEn: timestamp('resuelto_en', { withTimezone: true }),
    motivoDescarte: text('motivo_descarte'),
    entidadTipo: text('entidad_tipo'),
    entidadId: text('entidad_id'),
  },
  (t) => [
    check('borrador_origen', sql`${t.origen} IN ('voz', 'texto', 'agente', 'regla', 'conector', 'importacion')`),
    check('borrador_prioridad', sql`${t.prioridad} IN ('normal', 'alta')`),
    check('borrador_estado', sql`${t.estado} IN ('pendiente', 'aprobado', 'descartado')`),
    index('idx_borradores_estado').on(t.tenantId, t.estado, t.propuestoEn.desc()),
    index('idx_borradores_modulo').on(t.tenantId, t.modulo, t.estado),
  ],
);

/** Reglas «cuando pase X, haz Y». Nacen inactivas y en modo borrador. */
export const reglasAutomaticas = core.table(
  'reglas_automaticas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    activa: boolean('activa').notNull().default(false),
    disparadorTipo: text('disparador_tipo').notNull(),
    disparador: jsonb('disparador').notNull(),
    condiciones: jsonb('condiciones').notNull().default(sql`'[]'::jsonb`),
    acciones: jsonb('acciones').notNull(),
    modo: text('modo').notNull().default('borrador'),
    limiteDiario: integer('limite_diario').notNull().default(50),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
  },
  (t) => [
    unique('reglas_automaticas_empresa_id').on(t.tenantId, t.id),
    check('regla_disparador_tipo', sql`${t.disparadorTipo} IN ('evento', 'tiempo', 'webhook', 'manual')`),
    check('regla_modo', sql`${t.modo} IN ('borrador', 'pide_aprobacion', 'automatico')`),
    check('regla_limite_diario', sql`${t.limiteDiario} > 0`),
    index('idx_reglas_activa').on(t.tenantId, t.activa, t.disparadorTipo),
  ],
);

/** Historial de ejecuciones (reales y simuladas). Solo inserción desde el código. */
export const reglasEjecuciones = core.table(
  'reglas_ejecuciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    reglaId: uuid('regla_id').notNull(),
    disparadoPor: jsonb('disparado_por').notNull(),
    simulada: boolean('simulada').notNull().default(false),
    resultado: text('resultado').notNull(),
    detalle: jsonb('detalle'),
    borradorId: uuid('borrador_id'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'reglas_ejecuciones_regla_fk',
      columns: [t.tenantId, t.reglaId],
      foreignColumns: [reglasAutomaticas.tenantId, reglasAutomaticas.id],
    }),
    check(
      'regla_ejecucion_resultado',
      sql`${t.resultado} IN ('ok', 'rechazada', 'omitida_por_limite', 'borrador_creado', 'sin_coincidencia')`,
    ),
    index('idx_reglas_ejecuciones_regla').on(t.tenantId, t.reglaId, t.creadoEn.desc()),
    index('idx_reglas_ejecuciones_fecha').on(t.tenantId, t.creadoEn.desc()),
  ],
);

/** Una regla por tiempo dispara una sola vez por entidad y fecha (`clave`). */
export const reglasDisparos = core.table(
  'reglas_disparos',
  {
    tenantId: text('tenant_id').notNull(),
    reglaId: uuid('regla_id').notNull(),
    clave: text('clave').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.reglaId, t.clave] })],
);
