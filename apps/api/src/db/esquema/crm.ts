import { sql } from 'drizzle-orm';
import {
  bigint,
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
import { clientes, sucursales } from './core-maestros.js';

// Módulo `crm` · Oportunidades (fase 15, 0015). Especificación: docs/FICHAS-OLA-2.md §3.2.

export const crm = pgSchema('crm');

export const crmEtapas = crm.table(
  'etapas',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    orden: integer('orden').notNull(),
    tipo: text('tipo').notNull().default('abierta'),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('crm_etapas_empresa_id').on(t.tenantId, t.id),
    check('etapa_orden', sql`${t.orden} >= 0`),
    check('etapa_tipo', sql`${t.tipo} IN ('abierta', 'ganada', 'perdida')`),
    uniqueIndex('uq_crm_etapas_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    uniqueIndex('uq_crm_etapas_ganada').on(t.tenantId).where(sql`${t.tipo} = 'ganada' and ${t.archivadoEn} is null`),
    uniqueIndex('uq_crm_etapas_perdida').on(t.tenantId).where(sql`${t.tipo} = 'perdida' and ${t.archivadoEn} is null`),
  ],
);

export const crmOportunidades = crm.table(
  'oportunidades',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    titulo: text('titulo').notNull(),
    clienteId: uuid('cliente_id').notNull(),
    etapaId: uuid('etapa_id').notNull(),
    estado: text('estado').notNull().default('abierta'),
    montoEstimadoCentimos: bigint('monto_estimado_centimos', { mode: 'number' }),
    fechaEsperada: date('fecha_esperada', { mode: 'string' }),
    responsableId: text('responsable_id'),
    motivoPerdida: text('motivo_perdida'),
    cerradaEn: timestamp('cerrada_en', { withTimezone: true }),
    ultimaActividadEn: timestamp('ultima_actividad_en', { withTimezone: true }).notNull().defaultNow(),
    notas: text('notas'),
    sucursalId: uuid('sucursal_id'),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('crm_oportunidades_empresa_id').on(t.tenantId, t.id),
    unique('crm_oportunidades_numero').on(t.tenantId, t.anio, t.numero),
    foreignKey({ name: 'oportunidades_cliente_fk', columns: [t.tenantId, t.clienteId], foreignColumns: [clientes.tenantId, clientes.id] }),
    foreignKey({ name: 'oportunidades_etapa_fk', columns: [t.tenantId, t.etapaId], foreignColumns: [crmEtapas.tenantId, crmEtapas.id] }),
    foreignKey({ name: 'oportunidades_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    check('oportunidad_estado', sql`${t.estado} IN ('abierta', 'ganada', 'perdida')`),
    check('oportunidad_monto', sql`${t.montoEstimadoCentimos} is null or ${t.montoEstimadoCentimos} >= 0`),
    check('oportunidad_motivo', sql`${t.estado} = 'perdida' or ${t.motivoPerdida} is null`),
    check('oportunidad_cierre', sql`(${t.estado} = 'abierta') = (${t.cerradaEn} is null)`),
    index('idx_crm_oportunidades_etapa').on(t.tenantId, t.estado, t.etapaId, t.ultimaActividadEn.desc()),
    index('idx_crm_oportunidades_cliente').on(t.tenantId, t.clienteId),
    index('idx_crm_oportunidades_responsable').on(t.tenantId, t.responsableId, t.estado),
    index('idx_crm_oportunidades_creador').on(t.tenantId, t.creadoPor, t.creadoEn.desc()),
  ],
);

export const crmActividades = crm.table(
  'actividades',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    oportunidadId: uuid('oportunidad_id').notNull(),
    tipo: text('tipo').notNull(),
    asunto: text('asunto').notNull(),
    nota: text('nota'),
    venceEl: date('vence_el', { mode: 'string' }),
    hechaEn: timestamp('hecha_en', { withTimezone: true }),
    hechaPor: text('hecha_por'),
    responsableId: text('responsable_id'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({ name: 'actividades_oportunidad_fk', columns: [t.tenantId, t.oportunidadId], foreignColumns: [crmOportunidades.tenantId, crmOportunidades.id] }),
    check('actividad_tipo', sql`${t.tipo} IN ('llamada', 'reunion', 'mensaje', 'tarea', 'nota')`),
    check('actividad_hecha', sql`(${t.hechaEn} is null) = (${t.hechaPor} is null)`),
    index('idx_crm_actividades_oportunidad').on(t.tenantId, t.oportunidadId, t.creadoEn.desc()),
    index('idx_crm_actividades_vence').on(t.tenantId, t.venceEl).where(sql`${t.hechaEn} is null`),
  ],
);
