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
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clientes, productos, sucursales } from './core-maestros.js';

// Módulo `registro` · Finanzas ligeras (fase 14, 0014). Especificación: docs/FICHAS-OLA-2.md §3.1.

export const registro = pgSchema('registro');

export const registroCuentas = registro.table(
  'cuentas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    tipo: text('tipo').notNull(),
    sucursalId: uuid('sucursal_id'),
    esPrincipal: boolean('es_principal').notNull().default(false),
    saldoInicialCentimos: bigint('saldo_inicial_centimos', { mode: 'number' }).notNull().default(0),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('registro_cuentas_empresa_id').on(t.tenantId, t.id),
    check('cuenta_tipo', sql`${t.tipo} IN ('caja', 'banco', 'billetera')`),
    foreignKey({ name: 'cuentas_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    uniqueIndex('uq_registro_cuentas_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    uniqueIndex('uq_registro_cuentas_principal').on(t.tenantId).where(sql`${t.esPrincipal}`),
  ],
);

export const registroCategorias = registro.table(
  'categorias',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    tipo: text('tipo').notNull(),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('registro_categorias_empresa_id').on(t.tenantId, t.id),
    check('categoria_tipo', sql`${t.tipo} IN ('ingreso', 'egreso')`),
    uniqueIndex('uq_registro_categorias_nombre').on(t.tenantId, t.tipo, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
  ],
);

export const registroDeudas = registro.table(
  'deudas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    tipo: text('tipo').notNull(),
    contactoId: uuid('contacto_id').notNull(),
    concepto: text('concepto').notNull(),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull(),
    abonadoCentimos: bigint('abonado_centimos', { mode: 'number' }).notNull().default(0),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    venceEn: date('vence_en', { mode: 'string' }),
    estado: text('estado').notNull().default('pendiente'),
    origenTipo: text('origen_tipo'),
    origenId: text('origen_id'),
    sucursalId: uuid('sucursal_id'),
    notas: text('notas'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('registro_deudas_empresa_id').on(t.tenantId, t.id),
    unique('registro_deudas_numero').on(t.tenantId, t.tipo, t.anio, t.numero),
    foreignKey({ name: 'deudas_contacto_fk', columns: [t.tenantId, t.contactoId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'deudas_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('deuda_tipo', sql`${t.tipo} IN ('por_cobrar', 'por_pagar')`),
    check('deuda_total', sql`${t.totalCentimos} > 0`),
    check('deuda_abonado', sql`${t.abonadoCentimos} >= 0 and ${t.abonadoCentimos} <= ${t.totalCentimos}`),
    check('deuda_vence', sql`${t.venceEn} is null or ${t.venceEn} >= ${t.fecha}`),
    check('deuda_estado', sql`${t.estado} IN ('pendiente', 'parcial', 'pagada', 'anulada')`),
    check('deuda_origen', sql`(${t.origenTipo} is null) = (${t.origenId} is null)`),
    check('deuda_anulacion', sql`(${t.estado} = 'anulada') = (${t.anuladoEn} is not null)`),
    check(
      'deuda_estado_y_abonado',
      sql`${t.estado} = 'anulada' or (${t.estado} = 'pendiente' and ${t.abonadoCentimos} = 0) or (${t.estado} = 'parcial' and ${t.abonadoCentimos} > 0 and ${t.abonadoCentimos} < ${t.totalCentimos}) or (${t.estado} = 'pagada' and ${t.abonadoCentimos} = ${t.totalCentimos})`,
    ),
    uniqueIndex('uq_registro_deudas_origen')
      .on(t.tenantId, t.origenTipo, t.origenId)
      .where(sql`${t.origenId} is not null and ${t.estado} <> 'anulada'`),
    index('idx_registro_deudas_vence').on(t.tenantId, t.tipo, t.estado, t.venceEn),
    index('idx_registro_deudas_contacto').on(t.tenantId, t.contactoId, t.estado),
    index('idx_registro_deudas_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

/** Ajustes del total de una deuda: solo se agregan (inmutables). Total original + suma de ajustes = `deudas.total_centimos`. */
export const registroDeudaAjustes = registro.table(
  'deuda_ajustes',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    deudaId: uuid('deuda_id').notNull(),
    montoCentimos: bigint('monto_centimos', { mode: 'number' }).notNull(),
    totalAnteriorCentimos: bigint('total_anterior_centimos', { mode: 'number' }).notNull(),
    totalNuevoCentimos: bigint('total_nuevo_centimos', { mode: 'number' }).notNull(),
    aFavorCentimos: bigint('a_favor_centimos', { mode: 'number' }).notNull().default(0),
    motivoCodigo: text('motivo_codigo').notNull(),
    motivoTexto: text('motivo_texto'),
    origenRef: text('origen_ref'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'deuda_ajustes_deuda_fk', columns: [t.tenantId, t.deudaId], foreignColumns: [registroDeudas.tenantId, registroDeudas.id] }),
    check('ajuste_total_nuevo', sql`${t.totalNuevoCentimos} > 0`),
    check('ajuste_monto', sql`${t.montoCentimos} = ${t.totalNuevoCentimos} - ${t.totalAnteriorCentimos}`),
    check('ajuste_a_favor', sql`${t.aFavorCentimos} >= 0`),
    check('ajuste_motivo', sql`${t.motivoCodigo} IN ('igv', 'precio_acordado', 'cantidad', 'lineas', 'error_digitacion', 'otro')`),
    unique('uq_registro_deuda_ajustes_origen').on(t.tenantId, t.origenRef),
    index('idx_registro_deuda_ajustes_deuda').on(t.tenantId, t.deudaId, t.creadoEn.desc()),
  ],
);

/** Movimientos de dinero: inmutables salvo la anulación (permisos de columna, ADR-012). */
export const registroMovimientos = registro.table(
  'movimientos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    tipo: text('tipo').notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    montoCentimos: bigint('monto_centimos', { mode: 'number' }).notNull(),
    cuentaId: uuid('cuenta_id').notNull(),
    categoriaId: uuid('categoria_id'),
    contactoId: uuid('contacto_id'),
    medioDePago: text('medio_de_pago').notNull().default('efectivo'),
    descripcion: text('descripcion'),
    deudaId: uuid('deuda_id'),
    sucursalId: uuid('sucursal_id'),
    origen: text('origen').notNull().default('teclado'),
    origenRef: text('origen_ref'),
    estado: text('estado').notNull().default('activo'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('registro_movimientos_empresa_id').on(t.tenantId, t.id),
    unique('registro_movimientos_numero').on(t.tenantId, t.anio, t.numero),
    foreignKey({ name: 'movimientos_cuenta_fk', columns: [t.tenantId, t.cuentaId], foreignColumns: [registroCuentas.tenantId, registroCuentas.id] }),
    foreignKey({ name: 'movimientos_categoria_fk', columns: [t.tenantId, t.categoriaId], foreignColumns: [registroCategorias.tenantId, registroCategorias.id] }),
    foreignKey({ name: 'movimientos_contacto_fk', columns: [t.tenantId, t.contactoId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'movimientos_deuda_fk', columns: [t.tenantId, t.deudaId], foreignColumns: [registroDeudas.tenantId, registroDeudas.id] }),
    foreignKey({ name: 'movimientos_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('movimiento_tipo', sql`${t.tipo} IN ('ingreso', 'egreso')`),
    check('movimiento_monto', sql`${t.montoCentimos} > 0`),
    check('movimiento_medio', sql`${t.medioDePago} IN ('efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'otro')`),
    check('movimiento_origen', sql`${t.origen} IN ('teclado', 'voz', 'agente', 'regla', 'conector', 'importacion', 'modulo')`),
    check('movimiento_estado', sql`${t.estado} IN ('activo', 'anulado')`),
    check('movimiento_anulacion', sql`(${t.estado} = 'anulado') = (${t.anuladoEn} is not null)`),
    index('idx_registro_movimientos_fecha').on(t.tenantId, t.fecha.desc(), t.id.desc()),
    index('idx_registro_movimientos_cuenta').on(t.tenantId, t.cuentaId, t.fecha.desc()),
    index('idx_registro_movimientos_deuda').on(t.tenantId, t.deudaId).where(sql`${t.deudaId} is not null`),
    index('idx_registro_movimientos_contacto').on(t.tenantId, t.contactoId, t.fecha.desc()).where(sql`${t.contactoId} is not null`),
    index('idx_registro_movimientos_creador').on(t.tenantId, t.creadoPor, t.fecha.desc()),
  ],
);

/**
 * Productos de un movimiento (0038): detalle de cantidad y precio. Se insertan junto con el movimiento y nunca se tocan
 * (el movimiento es inmutable, ADR-012: corregir = anular y registrar otro con sus líneas copiadas o cambiadas).
 * Con líneas, `monto_centimos` del movimiento es la suma de `subtotal_centimos`.
 */
export const registroMovimientoLineas = registro.table(
  'movimiento_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    movimientoId: uuid('movimiento_id').notNull(),
    orden: integer('orden').notNull(),
    productoId: uuid('producto_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    precioUnitarioMilesimas: bigint('precio_unitario_milesimas', { mode: 'number' }).notNull(),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull(),
  },
  (t) => [
    unique('registro_movimiento_lineas_orden').on(t.tenantId, t.movimientoId, t.orden),
    foreignKey({ name: 'movimiento_lineas_movimiento_fk', columns: [t.tenantId, t.movimientoId], foreignColumns: [registroMovimientos.tenantId, registroMovimientos.id] }),
    foreignKey({ name: 'movimiento_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('movimiento_linea_orden', sql`${t.orden} >= 0 and ${t.orden} < 50`),
    check('movimiento_linea_descripcion', sql`length(${t.descripcion}) between 1 and 300`),
    check('movimiento_linea_unidad', sql`length(${t.unidad}) between 1 and 20`),
    check('movimiento_linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('movimiento_linea_precio', sql`${t.precioUnitarioMilesimas} >= 0`),
    check('movimiento_linea_subtotal', sql`${t.subtotalCentimos} >= 0`),
  ],
);

// Cierre semanal (0037): foto inmutable de los saldos de las cuentas al sábado. Cuentas y movimientos van dentro del JSON.
export const registroCierres = registro.table(
  'cierres',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    desde: date('desde', { mode: 'string' }).notNull(),
    hasta: date('hasta', { mode: 'string' }).notNull(),
    saldos: jsonb('saldos').notNull(),
    notas: text('notas'),
    cerradoPor: text('cerrado_por').notNull(),
    cerradoEn: timestamp('cerrado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('registro_cierres_empresa_id').on(t.tenantId, t.id),
    unique('registro_cierres_semana').on(t.tenantId, t.desde, t.hasta),
    check('cierre_semana', sql`${t.hasta} = ${t.desde} + 5 and extract(isodow from ${t.desde}) = 1`),
    check('cierre_saldos', sql`jsonb_typeof(${t.saldos}) = 'array'`),
    check('cierre_notas', sql`${t.notas} is null or length(${t.notas}) <= 1000`),
    index('idx_registro_cierres_cerrado').on(t.tenantId, t.cerradoEn.desc()),
  ],
);
