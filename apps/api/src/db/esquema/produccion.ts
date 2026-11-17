import { sql } from 'drizzle-orm';
import { bigint, check, date, foreignKey, index, integer, pgSchema, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { clientes } from './core-maestros.js';

// Módulo `produccion` · órdenes de trabajo del taller (0029 y 0030, modelo de SF). Dinero en céntimos enteros; cantidades en milésimas.
// El cobro real vive en `registro`: aquí solo se anota el total acordado, el adelanto y lo que falta cancelar.

export const produccion = pgSchema('produccion');

export const produccionOrdenes = produccion.table(
  'ordenes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    estado: text('estado').notNull().default('pendiente'),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    entregaEl: date('entrega_el', { mode: 'string' }),
    clienteId: uuid('cliente_id').notNull(),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull(),
    adelantoCentimos: bigint('adelanto_centimos', { mode: 'number' }).notNull().default(0),
    notas: text('notas'),
    destinoAdelanto: text('destino_adelanto'),
    entregadoEn: timestamp('entregado_en', { withTimezone: true }),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('produccion_ordenes_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'ordenes_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('orden_estado', sql`${t.estado} IN ('pendiente', 'en_maquina', 'listo', 'entregado', 'anulada')`),
    check('orden_montos', sql`${t.totalCentimos} > 0 and ${t.adelantoCentimos} >= 0 and ${t.adelantoCentimos} <= ${t.totalCentimos}`),
    check('orden_destino_adelanto', sql`${t.destinoAdelanto} is null or ${t.destinoAdelanto} IN ('devuelto', 'retenido')`),
    check('orden_fechas', sql`${t.entregaEl} is null or ${t.entregaEl} >= ${t.fecha}`),
    check('orden_entrega', sql`(${t.estado} = 'entregado') = (${t.entregadoEn} is not null)`),
    check('orden_anulacion', sql`(${t.estado} = 'anulada') = (${t.anuladoEn} is not null)`),
    uniqueIndex('uq_produccion_ordenes_numero').on(t.tenantId, t.anio, t.numero),
    index('idx_produccion_ordenes_estado').on(t.tenantId, t.estado, t.fecha.desc()),
    index('idx_produccion_ordenes_cliente').on(t.tenantId, t.clienteId, t.fecha.desc()),
    index('idx_produccion_ordenes_entrega').on(t.tenantId, t.entregaEl).where(sql`${t.entregaEl} is not null`),
  ],
);

/** Historial de la orden: solo se agrega (ADR-012). */
export const produccionOrdenEventos = produccion.table(
  'orden_eventos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    ordenId: uuid('orden_id').notNull(),
    tipo: text('tipo').notNull(),
    estadoAnterior: text('estado_anterior'),
    estadoNuevo: text('estado_nuevo').notNull(),
    nota: text('nota'),
    usuarioId: text('usuario_id').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'orden_eventos_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [produccionOrdenes.tenantId, produccionOrdenes.id] }),
    check('orden_evento_tipo', sql`${t.tipo} IN ('creada', 'editada', 'estado', 'anulada', 'cobro')`),
    index('idx_produccion_orden_eventos_orden').on(t.tenantId, t.ordenId, t.creadoEn),
  ],
);

/** Las líneas de una orden: cantidad, valor unitario y la ficha de máquina (material, medida, colores, acabado). */
export const produccionOrdenItems = produccion.table(
  'orden_items',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    ordenId: uuid('orden_id').notNull(),
    posicion: integer('posicion').notNull(),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    precioUnitarioMilesimas: bigint('precio_unitario_milesimas', { mode: 'number' }).notNull(),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull(),
    material: text('material'),
    medida: text('medida'),
    colores: text('colores'),
    acabado: text('acabado'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('produccion_orden_items_posicion').on(t.tenantId, t.ordenId, t.posicion),
    foreignKey({ name: 'orden_items_orden_fk', columns: [t.tenantId, t.ordenId], foreignColumns: [produccionOrdenes.tenantId, produccionOrdenes.id] }),
    check('orden_item_posicion', sql`${t.posicion} >= 0`),
    check('orden_item_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('orden_item_precio', sql`${t.precioUnitarioMilesimas} > 0`),
    check('orden_item_subtotal', sql`${t.subtotalCentimos} >= 0`),
  ],
);
