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

// Módulo `ordenes` · Pedidos (fase 16, 0016). Especificación: docs/FICHAS-OLA-2.md §3.2.
// D17: los precios de un pedido incluyen IGV; el porcentaje se guarda en cada pedido.

export const ordenes = pgSchema('ordenes');

export const ordenesPedidos = ordenes.table(
  'pedidos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero'),
    serie: text('serie'),
    anio: integer('anio'),
    clienteId: uuid('cliente_id').notNull(),
    estado: text('estado').notNull().default('borrador'),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    entregaEl: date('entrega_el', { mode: 'string' }),
    responsableId: text('responsable_id'),
    igvPorcentaje: smallint('igv_porcentaje').notNull().default(18),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull().default(0),
    igvCentimos: bigint('igv_centimos', { mode: 'number' }).notNull().default(0),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull().default(0),
    notas: text('notas'),
    sucursalId: uuid('sucursal_id'),
    origenTipo: text('origen_tipo'),
    origenId: text('origen_id'),
    confirmadoEn: timestamp('confirmado_en', { withTimezone: true }),
    entregadoEn: timestamp('entregado_en', { withTimezone: true }),
    canceladoEn: timestamp('cancelado_en', { withTimezone: true }),
    canceladoPor: text('cancelado_por'),
    motivoCancelacion: text('motivo_cancelacion'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ordenes_pedidos_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'pedidos_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'pedidos_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('pedido_numeracion', sql`(${t.numero} is null) = (${t.serie} is null) and (${t.numero} is null) = (${t.anio} is null)`),
    check('pedido_estado', sql`${t.estado} IN ('borrador', 'confirmado', 'en_proceso', 'listo', 'entregado', 'cancelado')`),
    check('pedido_estado_numero', sql`${t.estado} in ('borrador', 'cancelado') or ${t.numero} is not null`),
    check('pedido_igv_porcentaje', sql`${t.igvPorcentaje} between 0 and 100`),
    check('pedido_subtotal', sql`${t.subtotalCentimos} >= 0`),
    check('pedido_igv', sql`${t.igvCentimos} >= 0`),
    check('pedido_total', sql`${t.totalCentimos} = ${t.subtotalCentimos} + ${t.igvCentimos}`),
    check('pedido_origen', sql`(${t.origenTipo} is null) = (${t.origenId} is null)`),
    check('pedido_cancelacion', sql`(${t.estado} = 'cancelado') = (${t.canceladoEn} is not null)`),
    uniqueIndex('uq_ordenes_pedidos_numero').on(t.tenantId, t.serie, t.anio, t.numero).where(sql`${t.numero} is not null`),
    uniqueIndex('uq_ordenes_pedidos_origen')
      .on(t.tenantId, t.origenTipo, t.origenId)
      .where(sql`${t.origenId} is not null and ${t.estado} <> 'cancelado'`),
    index('idx_ordenes_pedidos_estado').on(t.tenantId, t.estado, t.entregaEl),
    index('idx_ordenes_pedidos_cliente').on(t.tenantId, t.clienteId, t.creadoEn.desc()),
    index('idx_ordenes_pedidos_responsable').on(t.tenantId, t.responsableId, t.estado),
    index('idx_ordenes_pedidos_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

export const ordenesPedidoLineas = ordenes.table(
  'pedido_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    pedidoId: uuid('pedido_id').notNull(),
    posicion: integer('posicion').notNull(),
    productoId: uuid('producto_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    precioUnitarioMilesimas: bigint('precio_unitario_milesimas', { mode: 'number' }).notNull(),
    afectoIgv: boolean('afecto_igv').notNull().default(true),
    importeCentimos: bigint('importe_centimos', { mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ordenes_pedido_lineas_posicion').on(t.tenantId, t.pedidoId, t.posicion),
    foreignKey({ name: 'pedido_lineas_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    foreignKey({ name: 'pedido_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('linea_posicion', sql`${t.posicion} >= 0`),
    check('linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('linea_precio', sql`${t.precioUnitarioMilesimas} >= 0`),
    check('linea_importe', sql`${t.importeCentimos} >= 0`),
  ],
);

export const ordenesPedidoEventos = ordenes.table(
  'pedido_eventos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    pedidoId: uuid('pedido_id').notNull(),
    tipo: text('tipo').notNull(),
    estadoAnterior: text('estado_anterior'),
    estadoNuevo: text('estado_nuevo'),
    nota: text('nota'),
    /** La huella de una corrección (`datos_editados`): campos con antes y después, y el motivo. */
    detalle: jsonb('detalle'),
    usuarioId: text('usuario_id').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'pedido_eventos_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    check('evento_tipo', sql`${t.tipo} IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota', 'datos_editados')`),
    index('idx_ordenes_pedido_eventos_pedido').on(t.tenantId, t.pedidoId, t.creadoEn.desc()),
  ],
);
