import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgSchema,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clientes, productos, sucursales } from './core-maestros.js';

// Módulo `compras` · Órdenes de compra (fase 18, 0020). Especificación: docs/FICHAS-OLA-3.md §1.2.
// P3-5 (D17): los costos de compra incluyen IGV; el porcentaje se guarda en cada orden.

export const compras = pgSchema('compras');

export const comprasOrdenes = compras.table(
  'ordenes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero'),
    serie: text('serie'),
    anio: integer('anio'),
    proveedorId: uuid('proveedor_id').notNull(),
    estado: text('estado').notNull().default('borrador'),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    entregaEl: date('entrega_el', { mode: 'string' }),
    igvPorcentaje: smallint('igv_porcentaje').notNull().default(18),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull().default(0),
    igvCentimos: bigint('igv_centimos', { mode: 'number' }).notNull().default(0),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull().default(0),
    notas: text('notas'),
    sucursalId: uuid('sucursal_id'),
    canceladoEn: timestamp('cancelado_en', { withTimezone: true }),
    canceladoPor: text('cancelado_por'),
    motivoCancelacion: text('motivo_cancelacion'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_ordenes_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'ordenes_proveedor_fk', columns: [t.tenantId, t.proveedorId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'ordenes_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('orden_numeracion', sql`(${t.numero} is null) = (${t.serie} is null) and (${t.numero} is null) = (${t.anio} is null)`),
    check('orden_estado', sql`${t.estado} IN ('borrador', 'enviada', 'recibida_parcial', 'recibida', 'cancelada')`),
    check('orden_estado_numero', sql`${t.estado} in ('borrador', 'cancelada') or ${t.numero} is not null`),
    check('orden_igv_porcentaje', sql`${t.igvPorcentaje} between 0 and 100`),
    check('orden_subtotal', sql`${t.subtotalCentimos} >= 0`),
    check('orden_igv', sql`${t.igvCentimos} >= 0`),
    check('orden_total', sql`${t.totalCentimos} = ${t.subtotalCentimos} + ${t.igvCentimos}`),
    check('orden_cancelacion', sql`(${t.estado} = 'cancelada') = (${t.canceladoEn} is not null)`),
    uniqueIndex('uq_compras_ordenes_numero').on(t.tenantId, t.serie, t.anio, t.numero).where(sql`${t.numero} is not null`),
    index('idx_compras_ordenes_estado').on(t.tenantId, t.estado, t.entregaEl),
    index('idx_compras_ordenes_proveedor').on(t.tenantId, t.proveedorId, t.creadoEn.desc()),
    index('idx_compras_ordenes_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

export const comprasOrdenLineas = compras.table(
  'orden_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    ordenId: uuid('orden_id').notNull(),
    posicion: integer('posicion').notNull(),
    productoId: uuid('producto_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    costoUnitarioMilesimas: bigint('costo_unitario_milesimas', { mode: 'number' }).notNull(),
    afectoIgv: boolean('afecto_igv').notNull().default(true),
    importeCentimos: bigint('importe_centimos', { mode: 'number' }).notNull(),
    recibidoMilesimas: bigint('recibido_milesimas', { mode: 'number' }).notNull().default(0),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_orden_lineas_empresa_id').on(t.tenantId, t.id),
    unique('compras_orden_lineas_posicion').on(t.tenantId, t.ordenId, t.posicion),
    foreignKey({ name: 'orden_lineas_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [comprasOrdenes.tenantId, comprasOrdenes.id] }),
    foreignKey({ name: 'orden_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('linea_posicion', sql`${t.posicion} >= 0`),
    check('linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('linea_costo', sql`${t.costoUnitarioMilesimas} >= 0`),
    check('linea_importe', sql`${t.importeCentimos} >= 0`),
    check('linea_recibido', sql`${t.recibidoMilesimas} >= 0`),
    check('linea_recibido_maximo', sql`${t.recibidoMilesimas} <= ${t.cantidadMilesimas}`),
  ],
);

export const comprasRecepciones = compras.table(
  'recepciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    ordenId: uuid('orden_id').notNull(),
    numero: integer('numero').notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    nota: text('nota'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_recepciones_empresa_id').on(t.tenantId, t.id),
    unique('compras_recepciones_numero').on(t.tenantId, t.ordenId, t.numero),
    foreignKey({ name: 'recepciones_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [comprasOrdenes.tenantId, comprasOrdenes.id] }),
    check('recepcion_numero', sql`${t.numero} > 0`),
  ],
);

export const comprasRecepcionLineas = compras.table(
  'recepcion_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    recepcionId: uuid('recepcion_id').notNull(),
    ordenLineaId: uuid('orden_linea_id').notNull(),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_recepcion_lineas_unica').on(t.tenantId, t.recepcionId, t.ordenLineaId),
    foreignKey({ name: 'recepcion_lineas_recepcion_fk', columns: [t.tenantId, t.recepcionId], foreignColumns: [comprasRecepciones.tenantId, comprasRecepciones.id] }),
    foreignKey({ name: 'recepcion_lineas_orden_linea_fk', columns: [t.tenantId, t.ordenLineaId], foreignColumns: [comprasOrdenLineas.tenantId, comprasOrdenLineas.id] }),
    check('recepcion_linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    index('idx_compras_recepcion_lineas_orden_linea').on(t.tenantId, t.ordenLineaId),
  ],
);
