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
  numeric,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clientes, productos } from './core-maestros.js';

// Módulo `cotizador` · datos del corte B1 (0024). Especificación: docs/FICHAS-OLA-4.md §6.
// Taller del cuadro por partes (B2) y enlaces públicos (B3) llegan con la 0027 (docs/FICHAS-COTIZADOR-B2-B3.md §2). `numeric` devuelve texto (lo que quiere el motor).

export const cotizador = pgSchema('cotizador');

export const cotizadorConfiguracion = cotizador.table(
  'configuracion',
  {
    tenantId: text('tenant_id').notNull(),
    utilidadPct: numeric('utilidad_pct', { precision: 7, scale: 3 }).notNull().default('35'),
    utilidadBase: text('utilidad_base').notNull().default('venta'),
    umbralVerdePct: numeric('umbral_verde_pct', { precision: 7, scale: 3 }).notNull().default('30'),
    umbralMinimoPct: numeric('umbral_minimo_pct', { precision: 7, scale: 3 }).notNull().default('15'),
    redondeoComercial: text('redondeo_comercial').notNull().default('ninguno'),
    igvPorcentaje: smallint('igv_porcentaje').notNull().default(18),
    condiciones: jsonb('condiciones').notNull().default(sql`'{}'::jsonb`),
    mensajeWhatsapp: text('mensaje_whatsapp'),
    actualizadoPor: text('actualizado_por'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'configuracion_pkey', columns: [t.tenantId] }),
    check('configuracion_utilidad_pct', sql`${t.utilidadPct} >= 0`),
    check('configuracion_utilidad_base', sql`${t.utilidadBase} IN ('venta', 'costo')`),
    check('configuracion_umbral_minimo', sql`${t.umbralMinimoPct} >= 0`),
    check('configuracion_redondeo', sql`${t.redondeoComercial} IN ('ninguno', '1', '5', '10')`),
    check('configuracion_igv', sql`${t.igvPorcentaje} between 0 and 100`),
    check('configuracion_umbrales', sql`${t.umbralMinimoPct} < ${t.umbralVerdePct}`),
    check('configuracion_utilidad', sql`${t.utilidadBase} = 'costo' or ${t.utilidadPct} < 100`),
  ],
);

export const cotizadorListasDePrecio = cotizador.table(
  'listas_de_precio',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    productoId: uuid('producto_id'),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    p100Centimos: bigint('p100_centimos', { mode: 'number' }).notNull(),
    p1000Centimos: bigint('p1000_centimos', { mode: 'number' }).notNull(),
    p5000Centimos: bigint('p5000_centimos', { mode: 'number' }).notNull(),
    modoIntermedio: text('modo_intermedio').notNull().default('curva'),
    precioMinimoCentimos: bigint('precio_minimo_centimos', { mode: 'number' }),
    aConfirmado: boolean('a_confirmado').notNull().default(false),
    preciosFijadosEn: timestamp('precios_fijados_en', { withTimezone: true }).notNull().defaultNow(),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cotizador_listas_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'listas_de_precio_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    check('lista_p100', sql`${t.p100Centimos} > 0`),
    check('lista_modo_intermedio', sql`${t.modoIntermedio} IN ('curva', 'escalon')`),
    check('lista_precio_minimo', sql`${t.precioMinimoCentimos} is null or ${t.precioMinimoCentimos} > 0`),
    check('lista_invariante_b', sql`${t.p100Centimos} < ${t.p1000Centimos} and ${t.p1000Centimos} < ${t.p5000Centimos}`),
    uniqueIndex('uq_cotizador_listas_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    index('idx_cotizador_listas_producto').on(t.tenantId, t.productoId).where(sql`${t.productoId} is not null`),
    uniqueIndex('uq_cotizador_listas_producto')
      .on(t.tenantId, t.productoId)
      .where(sql`${t.archivadoEn} is null and ${t.productoId} is not null`),
  ],
);

export const cotizadorAjustesDeCliente = cotizador.table(
  'ajustes_de_cliente',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    clienteId: uuid('cliente_id').notNull(),
    porcentaje: numeric('porcentaje', { precision: 7, scale: 3 }).notNull(),
    nota: text('nota'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_cotizador_ajustes_cliente').on(t.tenantId, t.clienteId),
    foreignKey({ name: 'ajustes_de_cliente_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('ajuste_porcentaje', sql`${t.porcentaje} > -100 and ${t.porcentaje} <= 500 and ${t.porcentaje} <> 0`),
  ],
);

export const cotizadorCotizaciones = cotizador.table(
  'cotizaciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero'),
    anio: integer('anio'),
    clienteId: uuid('cliente_id'),
    clienteNombre: text('cliente_nombre'),
    titulo: text('titulo').notNull(),
    estado: text('estado').notNull().default('borrador'),
    versionActual: integer('version_actual').notNull().default(1),
    validaHasta: date('valida_hasta', { mode: 'string' }),
    notas: text('notas'),
    lineasAceptadas: jsonb('lineas_aceptadas'),
    totalAceptadoCentimos: bigint('total_aceptado_centimos', { mode: 'number' }),
    aceptadaEn: timestamp('aceptada_en', { withTimezone: true }),
    motivoRechazo: text('motivo_rechazo'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cotizador_cotizaciones_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'cotizaciones_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    check('cotizacion_numeracion', sql`(${t.numero} is null) = (${t.anio} is null)`),
    check('cotizacion_estado', sql`${t.estado} IN ('borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada')`),
    check('cotizacion_version_actual', sql`${t.versionActual} >= 1`),
    check('cotizacion_total_aceptado', sql`${t.totalAceptadoCentimos} is null or ${t.totalAceptadoCentimos} >= 0`),
    check('cotizacion_aceptacion', sql`${t.estado} <> 'aceptada' or ${t.aceptadaEn} is not null`),
    check('cotizacion_anulacion', sql`(${t.estado} = 'anulada') = (${t.anuladoEn} is not null)`),
    check('cotizacion_estado_numero', sql`${t.estado} in ('borrador', 'anulada') or ${t.numero} is not null`),
    check('cotizacion_estado_cliente', sql`${t.estado} in ('borrador', 'anulada') or ${t.clienteId} is not null`),
    uniqueIndex('uq_cotizador_cotizaciones_numero').on(t.tenantId, t.anio, t.numero).where(sql`${t.numero} is not null`),
    index('idx_cotizador_cotizaciones_estado').on(t.tenantId, t.estado, t.creadoEn.desc()),
    index('idx_cotizador_cotizaciones_cliente').on(t.tenantId, t.clienteId, t.creadoEn.desc()),
    index('idx_cotizador_cotizaciones_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

export const cotizadorVersiones = cotizador.table(
  'versiones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    cotizacionId: uuid('cotizacion_id').notNull(),
    version: integer('version').notNull(),
    modo: text('modo').notNull().default('rapida'),
    conOpciones: boolean('con_opciones').notNull().default(false),
    igvPorcentaje: smallint('igv_porcentaje').notNull().default(18),
    subtotalCentimos: bigint('subtotal_centimos', { mode: 'number' }).notNull().default(0),
    igvCentimos: bigint('igv_centimos', { mode: 'number' }).notNull().default(0),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull().default(0),
    costoCentimos: bigint('costo_centimos', { mode: 'number' }),
    margenPct: numeric('margen_pct', { precision: 7, scale: 3 }),
    motivoMargenBajo: text('motivo_margen_bajo'),
    condiciones: jsonb('condiciones').notNull().default(sql`'{}'::jsonb`),
    observaciones: text('observaciones'),
    entrada: jsonb('entrada').notNull().default(sql`'{}'::jsonb`),
    resultado: jsonb('resultado'),
    emitidaEn: timestamp('emitida_en', { withTimezone: true }),
    emitidaPor: text('emitida_por'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cotizador_versiones_empresa_id').on(t.tenantId, t.id),
    unique('cotizador_versiones_numero').on(t.tenantId, t.cotizacionId, t.version),
    foreignKey({ name: 'versiones_cotizacion_fk', columns: [t.tenantId, t.cotizacionId], foreignColumns: [cotizadorCotizaciones.tenantId, cotizadorCotizaciones.id] }),
    check('version_numero', sql`${t.version} >= 1`),
    check('version_modo', sql`${t.modo} IN ('rapida', 'cuadro')`),
    check('version_igv_porcentaje', sql`${t.igvPorcentaje} between 0 and 100`),
    check('version_subtotal', sql`${t.subtotalCentimos} >= 0`),
    check('version_igv', sql`${t.igvCentimos} >= 0`),
    check('version_total', sql`${t.totalCentimos} = ${t.subtotalCentimos} + ${t.igvCentimos}`),
    check('version_costo', sql`${t.costoCentimos} is null or ${t.costoCentimos} >= 0`),
    check('version_emision', sql`(${t.emitidaEn} is null) = (${t.emitidaPor} is null)`),
  ],
);

export const cotizadorVersionLineas = cotizador.table(
  'version_lineas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    versionId: uuid('version_id').notNull(),
    posicion: integer('posicion').notNull(),
    productoId: uuid('producto_id'),
    listaId: uuid('lista_id'),
    descripcion: text('descripcion').notNull(),
    unidad: text('unidad').notNull().default('unidad'),
    cantidadMilesimas: bigint('cantidad_milesimas', { mode: 'number' }).notNull(),
    precioUnitarioMilesimas: bigint('precio_unitario_milesimas', { mode: 'number' }).notNull(),
    importeCentimos: bigint('importe_centimos', { mode: 'number' }).notNull(),
    igvCentimos: bigint('igv_centimos', { mode: 'number' }).notNull(),
    totalCentimos: bigint('total_centimos', { mode: 'number' }).notNull(),
    origenPrecio: text('origen_precio').notNull().default('manual'),
    detalle: jsonb('detalle').notNull().default(sql`'{}'::jsonb`),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('cotizador_version_lineas_posicion').on(t.tenantId, t.versionId, t.posicion),
    foreignKey({ name: 'version_lineas_version_fk', columns: [t.tenantId, t.versionId], foreignColumns: [cotizadorVersiones.tenantId, cotizadorVersiones.id] }),
    foreignKey({ name: 'version_lineas_producto_fk', columns: [t.tenantId, t.productoId], foreignColumns: [productos.tenantId, productos.id] }),
    foreignKey({ name: 'version_lineas_lista_fk', columns: [t.tenantId, t.listaId], foreignColumns: [cotizadorListasDePrecio.tenantId, cotizadorListasDePrecio.id] }),
    check('linea_posicion', sql`${t.posicion} >= 0`),
    check('linea_cantidad', sql`${t.cantidadMilesimas} > 0`),
    check('linea_precio_unitario', sql`${t.precioUnitarioMilesimas} >= 0`),
    check('linea_importe', sql`${t.importeCentimos} >= 0`),
    check('linea_igv', sql`${t.igvCentimos} >= 0`),
    check('linea_total', sql`${t.totalCentimos} = ${t.importeCentimos} + ${t.igvCentimos}`),
    check('linea_origen_precio', sql`${t.origenPrecio} IN ('lista', 'manual')`),
  ],
);

export const cotizadorEventos = cotizador.table(
  'eventos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    cotizacionId: uuid('cotizacion_id').notNull(),
    version: integer('version').notNull(),
    tipo: text('tipo').notNull(),
    motivo: text('motivo'),
    datos: jsonb('datos').notNull().default(sql`'{}'::jsonb`),
    usuarioId: text('usuario_id'),
    canal: text('canal').notNull().default('ui'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'eventos_cotizacion_fk', columns: [t.tenantId, t.cotizacionId], foreignColumns: [cotizadorCotizaciones.tenantId, cotizadorCotizaciones.id] }),
    check('evento_version', sql`${t.version} >= 1`),
    check('evento_tipo', sql`${t.tipo} IN ('creada', 'editada', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'nueva_version', 'vista', 'enlace_generado', 'enlace_revocado')`),
    check('evento_canal', sql`${t.canal} IN ('ui', 'enlace', 'sistema')`),
    index('idx_cotizador_eventos_cotizacion').on(t.tenantId, t.cotizacionId, t.creadoEn.desc()),
  ],
);

// ===== 0027 · taller del cuadro por partes y enlaces públicos =====

const comunes = () => ({
  id: uuid('id').primaryKey().default(sql`uuidv7()`),
  tenantId: text('tenant_id').notNull(),
});
const auditoria = () => ({
  creadoPor: text('creado_por').notNull(),
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
});
const FACTORES = `('material', 'impresion', 'planchas', 'diseno', 'acabado', 'indirectos')`;

export const cotizadorFormatosPliego = cotizador.table(
  'formatos_pliego',
  {
    ...comunes(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    anchoCm: numeric('ancho_cm', { precision: 7, scale: 2 }).notNull(),
    altoCm: numeric('alto_cm', { precision: 7, scale: 2 }).notNull(),
    tipo: text('tipo').notNull(),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    ...auditoria(),
  },
  (t) => [
    unique('cotizador_formatos_pliego_empresa_id').on(t.tenantId, t.id),
    check('formato_tipo', sql`${t.tipo} IN ('madre', 'maquina')`),
    check('formato_medidas', sql`${t.anchoCm} > 0 and ${t.altoCm} > 0`),
    uniqueIndex('uq_cotizador_formatos_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
  ],
);

export const cotizadorMaquinas = cotizador.table(
  'maquinas',
  {
    ...comunes(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    formatoMaxAnchoCm: numeric('formato_max_ancho_cm', { precision: 7, scale: 2 }).notNull(),
    formatoMaxAltoCm: numeric('formato_max_alto_cm', { precision: 7, scale: 2 }).notNull(),
    pinzaCm: numeric('pinza_cm', { precision: 7, scale: 2 }).notNull(),
    sangradoCm: numeric('sangrado_cm', { precision: 7, scale: 2 }).notNull(),
    calleCm: numeric('calle_cm', { precision: 7, scale: 2 }).notNull(),
    etapas: jsonb('etapas').notNull().default(sql`'[]'::jsonb`),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    ...auditoria(),
  },
  (t) => [
    unique('cotizador_maquinas_empresa_id').on(t.tenantId, t.id),
    check('maquina_medidas', sql`${t.formatoMaxAnchoCm} >= 0 and ${t.formatoMaxAltoCm} >= 0 and ${t.pinzaCm} >= 0 and ${t.sangradoCm} >= 0 and ${t.calleCm} >= 0`),
    uniqueIndex('uq_cotizador_maquinas_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
  ],
);

export const cotizadorTarifas = cotizador.table(
  'tarifas',
  {
    ...comunes(),
    factor: text('factor').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    unidad: text('unidad').notNull(),
    costoUnitario: numeric('costo_unitario', { precision: 14, scale: 4 }).notNull(),
    escalaPorDefecto: text('escala_por_defecto').notNull(),
    formatoId: uuid('formato_id'),
    // Par blando hacia insumos.articulos: sin llave foránea (R6).
    articuloId: uuid('articulo_id'),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    ...auditoria(),
  },
  (t) => [
    unique('cotizador_tarifas_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'tarifas_formato_fk', columns: [t.tenantId, t.formatoId], foreignColumns: [cotizadorFormatosPliego.tenantId, cotizadorFormatosPliego.id] }),
    check('tarifa_factor', sql`${t.factor} IN ${sql.raw(FACTORES)}`),
    check('tarifa_escala', sql`${t.escalaPorDefecto} IN ('fija', 'por_pliego', 'por_unidad')`),
    check('tarifa_costo', sql`${t.costoUnitario} >= 0`),
    uniqueIndex('uq_cotizador_tarifas_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    index('idx_cotizador_tarifas_formato').on(t.tenantId, t.formatoId).where(sql`${t.formatoId} is not null`),
  ],
);

export const cotizadorItemsDelCuadro = cotizador.table(
  'items_del_cuadro',
  {
    ...comunes(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    factor: text('factor').notNull(),
    despuesDe: text('despues_de').notNull(),
    posicion: integer('posicion').notNull(),
    fija: boolean('fija').notNull().default(false),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    ...auditoria(),
  },
  (t) => [
    unique('cotizador_items_del_cuadro_empresa_id').on(t.tenantId, t.id),
    check('item_factor', sql`${t.factor} IN ${sql.raw(FACTORES)}`),
    check('item_despues_de', sql`${t.despuesDe} IN ${sql.raw(FACTORES)}`),
    check('item_posicion', sql`${t.posicion} >= 0`),
    uniqueIndex('uq_cotizador_items_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
  ],
);

export const cotizadorEnlaces = cotizador.table(
  'enlaces',
  {
    ...comunes(),
    cotizacionId: uuid('cotizacion_id').notNull(),
    version: integer('version').notNull(),
    tokenHash: text('token_hash').notNull(),
    venceEn: timestamp('vence_en', { withTimezone: true }).notNull(),
    revocadoEn: timestamp('revocado_en', { withTimezone: true }),
    vistas: integer('vistas').notNull().default(0),
    ultimaVistaEn: timestamp('ultima_vista_en', { withTimezone: true }),
    ...auditoria(),
  },
  (t) => [
    unique('cotizador_enlaces_empresa_id').on(t.tenantId, t.id),
    unique('uq_cotizador_enlaces_token').on(t.tokenHash),
    foreignKey({ name: 'enlaces_cotizacion_fk', columns: [t.tenantId, t.cotizacionId], foreignColumns: [cotizadorCotizaciones.tenantId, cotizadorCotizaciones.id] }),
    check('enlace_version', sql`${t.version} >= 1`),
    check('enlace_vistas', sql`${t.vistas} >= 0`),
    index('idx_cotizador_enlaces_cotizacion').on(t.tenantId, t.cotizacionId, t.version),
  ],
);
