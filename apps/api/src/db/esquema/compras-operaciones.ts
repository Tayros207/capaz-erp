import { sql } from 'drizzle-orm';
import { bigint, check, date, foreignKey, index, integer, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clientes, productos } from './core-maestros.js';
import { compras, comprasOrdenes } from './compras.js';

// Compras · operaciones de empresa grande (0026): solicitudes de compra y facturas del proveedor.
// Dinero en céntimos enteros (regla 9); cantidades en milésimas.

/** Pedido interno de compra: alguien pide, otra persona aprueba y de ahí sale una orden. */
export const comprasSolicitudes = compras.table(
  'solicitudes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero'),
    anio: integer('anio'),
    estado: text('estado').notNull().default('borrador'),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    necesariaEl: date('necesaria_el', { mode: 'string' }),
    area: text('area'),
    motivo: text('motivo'),
    ordenId: uuid('orden_id'),
    solicitadoPor: text('solicitado_por').notNull(),
    resueltoPor: text('resuelto_por'),
    resueltoEn: timestamp('resuelto_en', { withTimezone: true }),
    motivoResolucion: text('motivo_resolucion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_solicitudes_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'solicitudes_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [comprasOrdenes.tenantId, comprasOrdenes.id] }),
    check('solicitud_estado', sql`${t.estado} IN ('borrador', 'pendiente', 'aprobada', 'rechazada', 'convertida', 'anulada')`),
    check('solicitud_numeracion', sql`(${t.numero} is null) = (${t.anio} is null)`),
    check('solicitud_estado_numero', sql`${t.estado} in ('borrador', 'anulada') or ${t.numero} is not null`),
    check('solicitud_resolucion', sql`(${t.estado} in ('aprobada', 'rechazada', 'convertida')) = (${t.resueltoEn} is not null) or ${t.estado} = 'anulada'`),
    check('solicitud_conversion', sql`(${t.estado} = 'convertida') = (${t.ordenId} is not null)`),
    uniqueIndex('uq_compras_solicitudes_numero').on(t.tenantId, t.anio, t.numero).where(sql`${t.numero} is not null`),
    index('idx_compras_solicitudes_estado').on(t.tenantId, t.estado, t.creadoEn.desc()),
  ],
);

export const comprasSolicitudLineas = compras.table(
  'solicitud_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    solicitudId: uuid('solicitud_id').notNull(),
    posicion: integer('posicion').notNull(),
    productoId: uuid('producto_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_solicitud_lineas_posicion').on(t.tenantId, t.solicitudId, t.posicion),
    foreignKey({ name: 'solicitud_lineas_solicitud_fk', columns: [t.tenantId, t.solicitudId], foreignColumns: [comprasSolicitudes.tenantId, comprasSolicitudes.id] }),
    foreignKey({ name: 'solicitud_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('solicitud_linea_posicion', sql`${t.posicion} >= 0`),
    check('solicitud_linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
  ],
);

/** Comprobante que manda el proveedor. Se concilia contra la orden y lo recibido; no mueve existencias ni dinero. */
export const comprasFacturas = compras.table(
  'facturas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    proveedorId: uuid('proveedor_id').notNull(),
    ordenId: uuid('orden_id'),
    serie: text('serie').notNull(),
    numero: text('numero').notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    venceEl: date('vence_el', { mode: 'string' }),
    moneda: text('moneda').notNull().default('PEN'),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull(),
    igvCentimos: bigint('igv_centimos', { mode: 'number' }).notNull().default(0),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull(),
    notas: text('notas'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('compras_facturas_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'facturas_proveedor_fk', columns: [t.tenantId, t.proveedorId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'facturas_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [comprasOrdenes.tenantId, comprasOrdenes.id] }),
    check('factura_moneda', sql`${t.moneda} in ('PEN', 'USD', 'EUR')`),
    check('factura_montos', sql`${t.subtotalCentimos} >= 0 and ${t.igvCentimos} >= 0`),
    check('factura_total', sql`${t.totalCentimos} = ${t.subtotalCentimos} + ${t.igvCentimos}`),
    check('factura_anulacion', sql`(${t.anuladoEn} is null) = (${t.anuladoPor} is null)`),
    // El mismo comprobante del mismo proveedor no se registra dos veces (salvo que esté anulado).
    uniqueIndex('uq_compras_facturas_comprobante').on(t.tenantId, t.proveedorId, t.serie, t.numero).where(sql`${t.anuladoEn} is null`),
    index('idx_compras_facturas_orden').on(t.tenantId, t.ordenId).where(sql`${t.ordenId} is not null`),
    index('idx_compras_facturas_proveedor').on(t.tenantId, t.proveedorId, t.fecha.desc()),
  ],
);
