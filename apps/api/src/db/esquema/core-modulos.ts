import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Módulos, planes y contratación (fase 4). Quién contrata y da de baja es la PLATAFORMA
// (`capaz_sistema`, funciones `core.activar_modulo` y similares); la empresa solo LEE su contratación.
// Los permisos de cada tabla van a mano en la migración (`aplicar_aislamiento`, `abrir_a_plataforma`).

/** Catálogo de módulos. Se sincroniza al arrancar desde los manifiestos (`core/modulos/catalogo.ts`). */
export const modulos = core.table('modulos', {
  codigo: text('codigo').primaryKey(),
  nombre: text('nombre').notNull(),
  descripcion: text('descripcion'),
  version: text('version').notNull().default('0.0.0'),
  dependeDe: text('depende_de').array().notNull().default(sql`'{}'::text[]`),
  activo: boolean('activo').notNull().default(true),
  /** Toda empresa nueva lo recibe. Decisión comercial editable como dato. */
  porDefecto: boolean('por_defecto').notNull().default(false),
  /** Días de prueba al recibirlo por defecto; nulo = activo sin prueba. */
  pruebaDias: integer('prueba_dias'),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

export const planes = core.table(
  'planes',
  {
    codigo: text('codigo').primaryKey(),
    nombre: text('nombre').notNull(),
    descripcion: text('descripcion'),
    precioCentimos: bigint('precio_centimos', { mode: 'number' }).notNull().default(0),
    usuariosIncluidos: integer('usuarios_incluidos'),
    activo: boolean('activo').notNull().default(true),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('plan_precio', sql`${t.precioCentimos} >= 0`)],
);

export const planModulos = core.table(
  'plan_modulos',
  {
    plan: text('plan').notNull().references(() => planes.codigo, { onDelete: 'cascade' }),
    modulo: text('modulo').notNull().references(() => modulos.codigo),
  },
  (t) => [primaryKey({ columns: [t.plan, t.modulo] })],
);

/** Contratación por empresa: prueba (con vencimiento), activo, suspendido o baja (solo lectura). */
export const empresaModulos = core.table(
  'empresa_modulos',
  {
    tenantId: text('tenant_id').notNull(),
    modulo: text('modulo').notNull().references(() => modulos.codigo),
    estado: text('estado').notNull().default('activo'),
    altaEn: timestamp('alta_en', { withTimezone: true }).notNull().defaultNow(),
    pruebaHasta: timestamp('prueba_hasta', { withTimezone: true }),
    bajaEn: timestamp('baja_en', { withTimezone: true }),
    motivo: text('motivo'),
    plan: text('plan').references(() => planes.codigo),
    precioAcordadoCentimos: bigint('precio_acordado_centimos', { mode: 'number' }),
    vigenteHasta: timestamp('vigente_hasta', { withTimezone: true }),
    maxUsuarios: integer('max_usuarios'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.modulo] }),
    check('empresa_modulo_estado', sql`${t.estado} IN ('prueba', 'activo', 'suspendido', 'baja')`),
    check('empresa_modulo_prueba', sql`(${t.estado} = 'prueba') = (${t.pruebaHasta} IS NOT NULL)`),
    check('empresa_modulo_baja', sql`(${t.estado} = 'baja') = (${t.bajaEn} IS NOT NULL)`),
    check('empresa_modulo_precio', sql`${t.precioAcordadoCentimos} IS NULL OR ${t.precioAcordadoCentimos} >= 0`),
    check('empresa_modulo_usuarios', sql`${t.maxUsuarios} IS NULL OR ${t.maxUsuarios} > 0`),
  ],
);

/** Historial de contratación: solo inserción, lo escribe un disparador. */
export const empresaModulosEventos = core.table(
  'empresa_modulos_eventos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    modulo: text('modulo').notNull().references(() => modulos.codigo),
    evento: text('evento').notNull(),
    estadoAnterior: text('estado_anterior'),
    estadoNuevo: text('estado_nuevo').notNull(),
    motivo: text('motivo'),
    actor: text('actor'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('modulo_evento_tipo', sql`${t.evento} IN ('alta', 'prueba', 'suspension', 'baja', 'reactivacion', 'cambio')`),
    index('idx_modulos_eventos_empresa').on(t.tenantId, t.creadoEn.desc()),
  ],
);

/** Qué módulo y con qué nivel usa cada usuario de la empresa. Sin fila, no entra. */
export const usuarioModulos = core.table(
  'usuario_modulos',
  {
    tenantId: text('tenant_id').notNull(),
    usuarioId: text('usuario_id').notNull(),
    modulo: text('modulo').notNull(),
    nivel: text('nivel').notNull().default('completo'),
    alcance: text('alcance').notNull().default('todos'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.usuarioId, t.modulo] }),
    // Solo se asigna lo que la empresa tiene contratado. Llave compuesta: no pasa por la RLS.
    foreignKey({
      name: 'usuario_modulo_contratado',
      columns: [t.tenantId, t.modulo],
      foreignColumns: [empresaModulos.tenantId, empresaModulos.modulo],
    }),
    check('usuario_modulo_nivel', sql`${t.nivel} IN ('completo', 'lectura')`),
    // «propios» = solo lo que creó ese usuario (encargada, vendedor); «todos» = lo de la empresa.
    check('usuario_modulo_alcance', sql`${t.alcance} IN ('todos', 'propios')`),
  ],
);

/** Cuando un usuario pulsa «Solicitar» un módulo no contratado. */
export const solicitudesModulo = core.table(
  'solicitudes_modulo',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    modulo: text('modulo').notNull().references(() => modulos.codigo),
    usuarioId: text('usuario_id').notNull(),
    nota: text('nota'),
    estado: text('estado').notNull().default('pendiente'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    atendidoEn: timestamp('atendido_en', { withTimezone: true }),
  },
  (t) => [
    check('solicitud_estado', sql`${t.estado} IN ('pendiente', 'atendida', 'descartada')`),
    // Todo índice de una tabla con tenant_id empieza por tenant_id (ADR-013); lo vigila una prueba de catálogo.
    index('idx_solicitudes_pendientes').on(t.tenantId, t.creadoEn).where(sql`${t.estado} = 'pendiente'`),
  ],
);

/** Quién entra a la consola de plataforma. Sin `tenant_id`: no pertenece a ninguna empresa. */
export const plataformaAdmins = core.table('plataforma_admins', {
  usuarioId: text('usuario_id').primaryKey(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
});

/** Estado de la cuenta de la empresa (pausa o baja global). Sin fila = activa. Lo cambia solo la plataforma. */
export const empresaCuenta = core.table(
  'empresa_cuenta',
  {
    tenantId: text('tenant_id').primaryKey(),
    estado: text('estado').notNull().default('activa'),
    motivo: text('motivo'),
    cambiadoEn: timestamp('cambiado_en', { withTimezone: true }).notNull().defaultNow(),
    cambiadoPor: text('cambiado_por'),
  },
  (t) => [check('empresa_cuenta_estado', sql`${t.estado} IN ('activa', 'prueba', 'pausada', 'baja')`)],
);

/** Historial de la cuenta: solo inserción, lo escribe un disparador. */
export const empresaCuentaEventos = core.table(
  'empresa_cuenta_eventos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    evento: text('evento').notNull(),
    estadoAnterior: text('estado_anterior'),
    estadoNuevo: text('estado_nuevo').notNull(),
    motivo: text('motivo'),
    actor: text('actor'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('cuenta_evento_tipo', sql`${t.evento} IN ('pausa', 'baja', 'reactivacion', 'alta')`),
    index('idx_cuenta_eventos_empresa').on(t.tenantId, t.creadoEn.desc()),
  ],
);
