import { sql } from 'drizzle-orm';
import { bigint, check, date, foreignKey, index, integer, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { sucursales } from './core-maestros.js';
import { insumos, insumosArticulos } from './insumos.js';

// Inventario · operaciones de empresa grande (0026): transferencias entre sucursales e inventario físico (conteos).
// Ninguna toca una existencia por su cuenta: lo hace `registrarMovimiento` (P3-1: sin existencia negativa).

/** Traslado de mercadería entre dos sucursales. Una vez hecha no se edita; un error se corrige con otra transferencia. */
export const insumosTransferencias = insumos.table(
  'transferencias',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    origenSucursalId: uuid('origen_sucursal_id').notNull(),
    destinoSucursalId: uuid('destino_sucursal_id').notNull(),
    fecha: date('fecha').notNull().default(sql`current_date`),
    nota: text('nota'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_transferencias_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'transferencias_origen_fk', columns: [t.tenantId, t.origenSucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    foreignKey({ name: 'transferencias_destino_fk', columns: [t.tenantId, t.destinoSucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('transferencia_sucursales_distintas', sql`${t.origenSucursalId} <> ${t.destinoSucursalId}`),
    uniqueIndex('uq_insumos_transferencias_numero').on(t.tenantId, t.anio, t.numero),
    index('idx_insumos_transferencias_fecha').on(t.tenantId, t.fecha.desc(), t.id),
  ],
);

export const insumosTransferenciaLineas = insumos.table(
  'transferencia_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    transferenciaId: uuid('transferencia_id').notNull(),
    articuloId: uuid('articulo_id').notNull(),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_transferencia_lineas_articulo').on(t.tenantId, t.transferenciaId, t.articuloId),
    foreignKey({ name: 'transferencia_lineas_transferencia_fk', columns: [t.tenantId, t.transferenciaId], foreignColumns: [insumosTransferencias.tenantId, insumosTransferencias.id] }),
    foreignKey({ name: 'transferencia_lineas_articulo_fk', columns: [t.tenantId, t.articuloId], foreignColumns: [insumosArticulos.tenantId, insumosArticulos.id] }),
    check('transferencia_linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
  ],
);

/** Inventario físico de una sucursal: se abre con una foto de lo que dice el sistema, se cuenta y al cerrar ajusta las diferencias. */
export const insumosConteos = insumos.table(
  'conteos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    sucursalId: uuid('sucursal_id').notNull(),
    estado: text('estado').notNull().default('abierto'),
    nota: text('nota'),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }),
    cerradoPor: text('cerrado_por'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_conteos_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'conteos_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('conteo_estado', sql`${t.estado} IN ('abierto', 'cerrado', 'anulado')`),
    check('conteo_cierre', sql`(${t.estado} = 'cerrado') = (${t.cerradoEn} is not null)`),
    check('conteo_anulacion', sql`(${t.estado} = 'anulado') = (${t.anuladoEn} is not null)`),
    uniqueIndex('uq_insumos_conteos_numero').on(t.tenantId, t.anio, t.numero),
    // Un solo inventario abierto por sucursal: dos conteos a la vez se pisarían las diferencias.
    uniqueIndex('uq_insumos_conteos_abierto').on(t.tenantId, t.sucursalId).where(sql`${t.estado} = 'abierto'`),
    index('idx_insumos_conteos_estado').on(t.tenantId, t.estado, t.creadoEn.desc()),
  ],
);

export const insumosConteoLineas = insumos.table(
  'conteo_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    conteoId: uuid('conteo_id').notNull(),
    articuloId: uuid('articulo_id').notNull(),
    /** Lo que decía el sistema al abrir el conteo (foto). La diferencia real se calcula al cerrar, sobre la existencia de ese momento. */
    sistemaMilesimas: bigint('sistema_milesimas', { mode: 'number' }).notNull(),
    contadaMilesimas: bigint('contada_milesimas', { mode: 'number' }),
    contadaPor: text('contada_por'),
    contadaEn: timestamp('contada_en', { withTimezone: true }),
    /** El ajuste que generó al cerrar; nulo si no hubo diferencia o no se contó. */
    movimientoId: uuid('movimiento_id'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('insumos_conteo_lineas_articulo').on(t.tenantId, t.conteoId, t.articuloId),
    foreignKey({ name: 'conteo_lineas_conteo_fk', columns: [t.tenantId, t.conteoId], foreignColumns: [insumosConteos.tenantId, insumosConteos.id] }),
    foreignKey({ name: 'conteo_lineas_articulo_fk', columns: [t.tenantId, t.articuloId], foreignColumns: [insumosArticulos.tenantId, insumosArticulos.id] }),
    check('conteo_linea_sistema', sql`${t.sistemaMilesimas} >= 0`),
    check('conteo_linea_contada', sql`${t.contadaMilesimas} is null or ${t.contadaMilesimas} >= 0`),
    check('conteo_linea_contada_completa', sql`(${t.contadaMilesimas} is null) = (${t.contadaEn} is null)`),
  ],
);
