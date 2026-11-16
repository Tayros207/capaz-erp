import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { productos, sucursales } from './core-maestros.js';

// Módulo `insumos` · Inventario (fase 17, 0018). Especificación: docs/FICHAS-OLA-3.md §1.1.
// P3-1: sin existencia negativa. P3-2: solo el último costo, informativo.

export const insumos = pgSchema('insumos');

export const insumosArticulos = insumos.table(
  'articulos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    minimoMilesimas: bigint('minimo_milesimas', { mode: 'number' }).notNull().default(0),
    ultimoCostoMilesimas: bigint('ultimo_costo_milesimas', { mode: 'number' }),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_articulos_empresa_id').on(t.tenantId, t.id),
    unique('insumos_articulos_producto').on(t.tenantId, t.productoId),
    foreignKey({ name: 'articulos_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('articulo_minimo', sql`${t.minimoMilesimas} >= 0`),
    check('articulo_ultimo_costo', sql`${t.ultimoCostoMilesimas} is null or ${t.ultimoCostoMilesimas} >= 0`),
  ],
);

export const insumosExistencias = insumos.table(
  'existencias',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    articuloId: uuid('articulo_id').notNull(),
    sucursalId: uuid('sucursal_id').notNull(),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull().default(0),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_existencias_articulo_sucursal').on(t.tenantId, t.articuloId, t.sucursalId),
    foreignKey({ name: 'existencias_articulo_fk', columns: [t.tenantId, t.articuloId], foreignColumns: [insumosArticulos.tenantId, insumosArticulos.id] }),
    foreignKey({ name: 'existencias_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('existencia_no_negativa', sql`${t.cantidadMilesimas} >= 0`),
    index('idx_insumos_existencias_sucursal').on(t.tenantId, t.sucursalId),
  ],
);

export const insumosMovimientos = insumos.table(
  'movimientos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    articuloId: uuid('articulo_id').notNull(),
    sucursalId: uuid('sucursal_id').notNull(),
    tipo: text('tipo').notNull(),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    existenciaResultanteMilesimas: bigint('existencia_resultante_milesimas', { mode: 'number' }).notNull(),
    costoUnitarioMilesimas: bigint('costo_unitario_milesimas', { mode: 'number' }),
    motivo: text('motivo'),
    origenTipo: text('origen_tipo'),
    origenId: text('origen_id'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'movimientos_articulo_fk', columns: [t.tenantId, t.articuloId], foreignColumns: [insumosArticulos.tenantId, insumosArticulos.id] }),
    foreignKey({ name: 'movimientos_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('movimiento_tipo', sql`${t.tipo} IN ('entrada', 'salida', 'ajuste')`),
    check(
      'movimiento_signo',
      sql`(${t.tipo} = 'entrada' and ${t.cantidadMilesimas} > 0) or (${t.tipo} = 'salida' and ${t.cantidadMilesimas} < 0) or (${t.tipo} = 'ajuste' and ${t.cantidadMilesimas} <> 0)`,
    ),
    check('movimiento_existencia_resultante', sql`${t.existenciaResultanteMilesimas} >= 0`),
    check('movimiento_costo', sql`${t.costoUnitarioMilesimas} is null or ${t.costoUnitarioMilesimas} >= 0`),
    check('movimiento_origen', sql`(${t.origenTipo} is null) = (${t.origenId} is null)`),
    uniqueIndex('uq_insumos_movimientos_origen')
      .on(t.tenantId, t.origenTipo, t.origenId, t.articuloId)
      .where(sql`${t.origenId} is not null`),
    index('idx_insumos_movimientos_articulo').on(t.tenantId, t.articuloId, t.creadoEn.desc()),
    index('idx_insumos_movimientos_sucursal').on(t.tenantId, t.sucursalId, t.creadoEn.desc()),
  ],
);
