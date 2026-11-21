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
    /** Versión del pedido: sube con cada corrección estando confirmado; las anteriores viven en `pedido_versiones`. */
    version: integer('version').notNull().default(1),
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
    check('pedido_version', sql`${t.version} >= 1`),
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
    /** Ficha de máquina (0036): texto libre opcional, como en `produccion.orden_items`. `null` = sin dato; nunca vacío. */
    material: text('material'),
    medida: text('medida'),
    colores: text('colores'),
    acabado: text('acabado'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ordenes_pedido_lineas_posicion').on(t.tenantId, t.pedidoId, t.posicion),
    unique('ordenes_pedido_lineas_pedido_id').on(t.tenantId, t.pedidoId, t.id),
    foreignKey({ name: 'pedido_lineas_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    foreignKey({ name: 'pedido_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('linea_posicion', sql`${t.posicion} >= 0`),
    check('linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('linea_precio', sql`${t.precioUnitarioMilesimas} >= 0`),
    check('linea_importe', sql`${t.importeCentimos} >= 0`),
    // 120 = MAXIMO_DE_CAMPO_DE_FICHA de @capaz/shared (el esquema no importa el paquete).
    check(
      'linea_ficha',
      sql`(${t.material} is null or length(${t.material}) between 1 and 120) and (${t.medida} is null or length(${t.medida}) between 1 and 120) and (${t.colores} is null or length(${t.colores}) between 1 and 120) and (${t.acabado} is null or length(${t.acabado}) between 1 and 120)`,
    ),
  ],
);

// Guías de remisión (control interno, sin SUNAT). Inmutables salvo la anulación.
export const ordenesGuias = ordenes.table(
  'guias',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    serie: text('serie').notNull(),
    numero: integer('numero').notNull(),
    estado: text('estado').notNull().default('emitida'),
    clienteId: uuid('cliente_id').notNull(),
    destinatarioNombre: text('destinatario_nombre').notNull(),
    destinatarioDocumento: text('destinatario_documento'),
    fechaEmision: date('fecha_emision', { mode: 'string' }).notNull(),
    fechaTraslado: date('fecha_traslado', { mode: 'string' }).notNull(),
    puntoPartida: text('punto_partida').notNull(),
    puntoLlegada: text('punto_llegada').notNull(),
    motivo: text('motivo').notNull(),
    motivoDetalle: text('motivo_detalle'),
    modalidad: text('modalidad').notNull(),
    transportista: text('transportista'),
    conductor: text('conductor'),
    licencia: text('licencia'),
    placa: text('placa'),
    bultos: text('bultos'),
    observaciones: text('observaciones'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ordenes_guias_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'guias_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('guia_numero', sql`${t.numero} > 0`),
    check('guia_estado', sql`${t.estado} IN ('emitida', 'anulada')`),
    check('guia_motivo', sql`${t.motivo} IN ('venta', 'entrega_de_trabajo', 'traslado_entre_locales', 'otro')`),
    check('guia_motivo_detalle', sql`${t.motivo} <> 'otro' or ${t.motivoDetalle} is not null`),
    check('guia_modalidad', sql`${t.modalidad} IN ('privado', 'publico')`),
    check('guia_transportista', sql`${t.modalidad} <> 'publico' or ${t.transportista} is not null`),
    check(
      'guia_anulacion',
      sql`(${t.estado} = 'anulada') = (${t.anuladoEn} is not null) and (${t.anuladoEn} is null) = (${t.anuladoPor} is null) and (${t.anuladoEn} is null) = (${t.motivoAnulacion} is null)`,
    ),
    uniqueIndex('uq_ordenes_guias_numero').on(t.tenantId, t.serie, t.numero),
    index('idx_ordenes_guias_creado').on(t.tenantId, t.creadoEn.desc()),
    index('idx_ordenes_guias_cliente').on(t.tenantId, t.clienteId, t.creadoEn.desc()),
    index('idx_ordenes_guias_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

export const ordenesGuiaLineas = ordenes.table(
  'guia_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    guiaId: uuid('guia_id').notNull(),
    posicion: integer('posicion').notNull(),
    pedidoId: uuid('pedido_id'),
    pedidoLineaId: uuid('pedido_linea_id'),
    productoId: uuid('producto_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('ordenes_guia_lineas_posicion').on(t.tenantId, t.guiaId, t.posicion),
    foreignKey({ name: 'guia_lineas_guia_fk', columns: [t.tenantId, t.guiaId], foreignColumns: [ordenesGuias.tenantId, ordenesGuias.id] }),
    foreignKey({ name: 'guia_lineas_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    foreignKey({
      name: 'guia_lineas_pedido_linea_fk',
      columns: [t.tenantId, t.pedidoId, t.pedidoLineaId],
      foreignColumns: [ordenesPedidoLineas.tenantId, ordenesPedidoLineas.pedidoId, ordenesPedidoLineas.id],
    }),
    foreignKey({ name: 'guia_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('guia_linea_posicion', sql`${t.posicion} >= 0`),
    check('guia_linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('guia_linea_origen', sql`(${t.pedidoId} is null) = (${t.pedidoLineaId} is null)`),
    uniqueIndex('uq_ordenes_guia_lineas_origen').on(t.tenantId, t.guiaId, t.pedidoLineaId).where(sql`${t.pedidoLineaId} is not null`),
    index('idx_ordenes_guia_lineas_pedido').on(t.tenantId, t.pedidoId, t.pedidoLineaId).where(sql`${t.pedidoId} is not null`),
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
    guiaId: uuid('guia_id'),
    usuarioId: text('usuario_id').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'pedido_eventos_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    foreignKey({ name: 'pedido_eventos_guia_fk', columns: [t.tenantId, t.guiaId], foreignColumns: [ordenesGuias.tenantId, ordenesGuias.id] }),
    check('evento_tipo', sql`${t.tipo} IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota', 'datos_editados', 'corregido', 'guia_emitida', 'guia_anulada')`),
    check('evento_guia', sql`(${t.tipo} in ('guia_emitida', 'guia_anulada')) = (${t.guiaId} is not null)`),
    index('idx_ordenes_pedido_eventos_pedido').on(t.tenantId, t.pedidoId, t.creadoEn.desc()),
    index('idx_ordenes_pedido_eventos_tipo').on(t.tenantId, t.tipo, t.creadoEn.desc()),
  ],
);

/** La foto de cada versión anterior de un pedido corregido. Solo se agrega: inmutable (ADR-012). */
export const ordenesPedidoVersiones = ordenes.table(
  'pedido_versiones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    pedidoId: uuid('pedido_id').notNull(),
    /** La versión que se guarda (la que la corrección reemplaza). */
    version: integer('version').notNull(),
    foto: jsonb('foto').notNull(),
    motivoCodigo: text('motivo_codigo').notNull(),
    motivoTexto: text('motivo_texto'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'pedido_versiones_pedido_fk', columns: [t.tenantId, t.pedidoId], foreignColumns: [ordenesPedidos.tenantId, ordenesPedidos.id] }),
    check('pedido_version_numero', sql`${t.version} >= 1`),
    check('pedido_version_motivo', sql`${t.motivoCodigo} IN ('igv', 'precio_acordado', 'cantidad', 'lineas', 'error_digitacion', 'otro')`),
    uniqueIndex('uq_ordenes_pedido_versiones').on(t.tenantId, t.pedidoId, t.version),
  ],
);
