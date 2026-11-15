import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { core } from './core.js';

// Fase 7: datos maestros (Clientes, Productos, Sucursales) (§6.4, 0008).

/** Clientes y proveedores (una sola tabla). Un fusionado libera su nombre; un archivado lo conserva. */
export const clientes = core.table(
  'clientes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    tipo: text('tipo').notNull().default('cliente'),
    clase: text('clase').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    documentoTipo: text('documento_tipo'),
    documentoNumero: text('documento_numero'),
    telefono: text('telefono'),
    correo: text('correo'),
    direccion: text('direccion'),
    notas: text('notas'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    fusionadoEn: uuid('fusionado_en'),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('clientes_empresa_id').on(t.tenantId, t.id),
    foreignKey({
      name: 'clientes_fusionado_fk',
      columns: [t.tenantId, t.fusionadoEn],
      foreignColumns: [t.tenantId, t.id],
    }),
    check('cliente_tipo', sql`${t.tipo} IN ('cliente', 'proveedor', 'ambos')`),
    check('cliente_clase', sql`${t.clase} IN ('persona', 'empresa')`),
    check('cliente_documento_tipo', sql`${t.documentoTipo} IS NULL OR ${t.documentoTipo} IN ('dni', 'ruc', 'ce', 'pasaporte', 'otro')`),
    uniqueIndex('uq_clientes_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.fusionadoEn} is null`),
    uniqueIndex('uq_clientes_documento')
      .on(t.tenantId, t.documentoTipo, t.documentoNumero)
      .where(sql`${t.documentoNumero} is not null and ${t.fusionadoEn} is null`),
    index('idx_clientes_parecido')
      .using('gin', t.tenantId.op('gin_trgm_ops'), t.nombreNormalizado.op('gin_trgm_ops'))
      .where(sql`${t.archivadoEn} is null`),
  ],
);

export const productos = core.table(
  'productos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    codigo: text('codigo'),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    tipo: text('tipo').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    precioUnitarioMilesimas: bigint('precio_unitario_milesimas', { mode: 'number' }).notNull().default(0),
    afectoIgv: boolean('afecto_igv').notNull().default(true),
    descripcion: text('descripcion'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('producto_tipo', sql`${t.tipo} IN ('producto', 'servicio')`),
    check('producto_precio', sql`${t.precioUnitarioMilesimas} >= 0`),
    uniqueIndex('uq_productos_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    uniqueIndex('uq_productos_codigo').on(t.tenantId, t.codigo).where(sql`${t.codigo} is not null`),
    index('idx_productos_parecido')
      .using('gin', t.tenantId.op('gin_trgm_ops'), t.nombreNormalizado.op('gin_trgm_ops'))
      .where(sql`${t.archivadoEn} is null`),
  ],
);

/** Sucursales. `codigo` sirve de serie de los correlativos. */
export const sucursales = core.table(
  'sucursales',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    codigo: text('codigo').notNull(),
    nombre: text('nombre').notNull(),
    direccion: text('direccion'),
    telefono: text('telefono'),
    esPrincipal: boolean('es_principal').notNull().default(false),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('sucursal_codigo', sql`${t.codigo} ~ '^[A-Z0-9]{2,6}$'`),
    unique('sucursales_empresa_codigo').on(t.tenantId, t.codigo),
    uniqueIndex('uq_sucursales_principal').on(t.tenantId).where(sql`${t.esPrincipal}`),
  ],
);
