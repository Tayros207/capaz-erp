import { sql } from 'drizzle-orm';
import { bigint, boolean, check, foreignKey, index, integer, numeric, primaryKey, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { core } from './core.js';
import { clientes, productos } from './core-maestros.js';

// Maestros ampliados (0025): lo que una empresa grande anota de un cliente/proveedor y de un producto.
// Son tablas aparte, una fila por cliente o producto (1 a 1) o varias (contactos, direcciones, unidades),
// para no tocar las columnas que ya usan los demás módulos.

/** Condiciones comerciales y bancarias de un cliente o proveedor (1 a 1 con `core.clientes`). */
export const clienteComercial = core.table(
  'cliente_comercial',
  {
    tenantId: text('tenant_id').notNull(),
    clienteId: uuid('cliente_id').notNull(),
    condicionPagoDias: integer('condicion_pago_dias').notNull().default(0),
    limiteCreditoCentimos: bigint('limite_credito_centimos', { mode: 'number' }),
    moneda: text('moneda').notNull().default('PEN'),
    vendedorId: text('vendedor_id'),
    segmento: text('segmento'),
    sitioWeb: text('sitio_web'),
    agenteRetencion: boolean('agente_retencion').notNull().default(false),
    sujetoDetraccion: boolean('sujeto_detraccion').notNull().default(false),
    banco: text('banco'),
    cuentaBancaria: text('cuenta_bancaria'),
    cci: text('cci'),
    notasComerciales: text('notas_comerciales'),
    actualizadoPor: text('actualizado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'cliente_comercial_pkey', columns: [t.tenantId, t.clienteId] }),
    foreignKey({ name: 'cliente_comercial_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('cliente_comercial_plazo', sql`${t.condicionPagoDias} between 0 and 365`),
    check('cliente_comercial_limite', sql`${t.limiteCreditoCentimos} is null or ${t.limiteCreditoCentimos} >= 0`),
    check('cliente_comercial_moneda', sql`${t.moneda} in ('PEN', 'USD', 'EUR')`),
  ],
);

/** Personas de contacto de un cliente o proveedor. Una sola puede ser la principal. */
export const clienteContactos = core.table(
  'cliente_contactos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    clienteId: uuid('cliente_id').notNull(),
    nombre: text('nombre').notNull(),
    cargo: text('cargo'),
    telefono: text('telefono'),
    correo: text('correo'),
    esPrincipal: boolean('es_principal').notNull().default(false),
    notas: text('notas'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cliente_contactos_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'cliente_contactos_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    index('idx_cliente_contactos_cliente').on(t.tenantId, t.clienteId),
    uniqueIndex('uq_cliente_contactos_principal').on(t.tenantId, t.clienteId).where(sql`${t.esPrincipal}`),
  ],
);

/** Direcciones de un cliente o proveedor: fiscal, de entrega u otra. Una sola principal por tipo. */
export const clienteDirecciones = core.table(
  'cliente_direcciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    clienteId: uuid('cliente_id').notNull(),
    tipo: text('tipo').notNull().default('entrega'),
    direccion: text('direccion').notNull(),
    ciudad: text('ciudad'),
    departamento: text('departamento'),
    referencia: text('referencia'),
    esPrincipal: boolean('es_principal').notNull().default(false),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cliente_direcciones_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'cliente_direcciones_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('cliente_direccion_tipo', sql`${t.tipo} in ('fiscal', 'entrega', 'otra')`),
    index('idx_cliente_direcciones_cliente').on(t.tenantId, t.clienteId),
    uniqueIndex('uq_cliente_direcciones_principal').on(t.tenantId, t.clienteId, t.tipo).where(sql`${t.esPrincipal}`),
  ],
);

/** Categorías de producto, en árbol de un nivel de profundidad libre (`padre_id`). */
export const categoriasProducto = core.table(
  'categorias_producto',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    padreId: uuid('padre_id'),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('categorias_producto_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'categorias_producto_padre_fk', columns: [t.tenantId, t.padreId], foreignColumns: [t.tenantId, t.id] }),
    check('categoria_producto_no_es_su_padre', sql`${t.padreId} is null or ${t.padreId} <> ${t.id}`),
    uniqueIndex('uq_categorias_producto_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
  ],
);

/** Datos de catálogo y logística de un producto (1 a 1 con `core.productos`). */
export const productoFicha = core.table(
  'producto_ficha',
  {
    tenantId: text('tenant_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    categoriaId: uuid('categoria_id'),
    marca: text('marca'),
    sku: text('sku'),
    codigoBarras: text('codigo_barras'),
    costoMilesimas: bigint('costo_milesimas', { mode: 'number' }),
    pesoGramos: numeric('peso_gramos', { precision: 12, scale: 3 }),
    altoMm: integer('alto_mm'),
    anchoMm: integer('ancho_mm'),
    largoMm: integer('largo_mm'),
    vendible: boolean('vendible').notNull().default(true),
    comprable: boolean('comprable').notNull().default(true),
    actualizadoPor: text('actualizado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'producto_ficha_pkey', columns: [t.tenantId, t.productoId] }),
    foreignKey({ name: 'producto_ficha_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    foreignKey({ name: 'producto_ficha_categoria_fk', columns: [t.tenantId, t.categoriaId], foreignColumns: [categoriasProducto.tenantId, categoriasProducto.id] }),
    check('producto_ficha_costo', sql`${t.costoMilesimas} is null or ${t.costoMilesimas} >= 0`),
    check('producto_ficha_medidas', sql`(${t.pesoGramos} is null or ${t.pesoGramos} >= 0) and (${t.altoMm} is null or ${t.altoMm} >= 0) and (${t.anchoMm} is null or ${t.anchoMm} >= 0) and (${t.largoMm} is null or ${t.largoMm} >= 0)`),
    uniqueIndex('uq_producto_ficha_sku').on(t.tenantId, t.sku).where(sql`${t.sku} is not null`),
    uniqueIndex('uq_producto_ficha_barras').on(t.tenantId, t.codigoBarras).where(sql`${t.codigoBarras} is not null`),
    index('idx_producto_ficha_categoria').on(t.tenantId, t.categoriaId).where(sql`${t.categoriaId} is not null`),
  ],
);

/** Otras unidades en que se compra o vende un producto, con su equivalencia en la unidad base. */
export const productoUnidades = core.table(
  'producto_unidades',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    productoId: uuid('producto_id').notNull(),
    unidad: text('unidad').notNull(),
    factorMilesimas: bigint('factor_milesimas', { mode: 'number' }).notNull(),
    paraCompra: boolean('para_compra').notNull().default(true),
    paraVenta: boolean('para_venta').notNull().default(true),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('producto_unidades_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'producto_unidades_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('producto_unidad_factor', sql`${t.factorMilesimas} > 0`),
    unique('producto_unidades_unica').on(t.tenantId, t.productoId, t.unidad),
  ],
);
