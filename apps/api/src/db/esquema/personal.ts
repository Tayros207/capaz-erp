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
import { sucursales } from './core-maestros.js';

// Módulo `personal` · Personal (fase 19, 0019). Especificación: docs/FICHAS-OLA-3.md §1.3.
// Datos personales: nunca en eventos ni en auditoría. Sin planilla.

export const personal = pgSchema('personal');

export const personalColaboradores = personal.table(
  'colaboradores',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    nombre: text('nombre').notNull(),
    nombreNormalizado: text('nombre_normalizado').notNull(),
    documentoTipo: text('documento_tipo'),
    documentoNumero: text('documento_numero'),
    telefono: text('telefono'),
    cargo: text('cargo'),
    usuarioId: text('usuario_id'),
    fechaIngreso: date('fecha_ingreso', { mode: 'string' }),
    sucursalId: uuid('sucursal_id'),
    archivadoEn: timestamp('archivado_en', { withTimezone: true }),
    datosExtra: jsonb('datos_extra').notNull().default(sql`'{}'::jsonb`),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_colaboradores_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'colaboradores_sucursal_fk', columns: [t.tenantId, t.sucursalId], foreignColumns: [sucursales.tenantId, sucursales.id] }),
    uniqueIndex('uq_personal_colaboradores_nombre').on(t.tenantId, t.nombreNormalizado).where(sql`${t.archivadoEn} is null`),
    index('idx_personal_colaboradores_usuario').on(t.tenantId, t.usuarioId).where(sql`${t.usuarioId} is not null`),
    index('idx_personal_colaboradores_sucursal').on(t.tenantId, t.sucursalId).where(sql`${t.sucursalId} is not null`),
  ],
);

export const personalAsistencias = personal.table(
  'asistencias',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    colaboradorId: uuid('colaborador_id').notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    entrada: timestamp('entrada', { withTimezone: true }),
    salida: timestamp('salida', { withTimezone: true }),
    estado: text('estado').notNull().default('presente'),
    nota: text('nota'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_asistencias_colaborador_fecha').on(t.tenantId, t.colaboradorId, t.fecha),
    foreignKey({ name: 'asistencias_colaborador_fk', columns: [t.tenantId, t.colaboradorId], foreignColumns: [personalColaboradores.tenantId, personalColaboradores.id] }),
    check('asistencia_estado', sql`${t.estado} IN ('presente', 'tardanza', 'falta', 'permiso', 'descanso')`),
    check('asistencia_salida', sql`${t.salida} is null or ${t.entrada} is not null`),
    index('idx_personal_asistencias_fecha').on(t.tenantId, t.fecha.desc()),
  ],
);

export const personalAdelantos = personal.table(
  'adelantos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    numero: integer('numero').notNull(),
    anio: integer('anio').notNull(),
    colaboradorId: uuid('colaborador_id').notNull(),
    montoCentimos: bigint('monto_centimos', { mode: 'number' }).notNull(),
    fecha: date('fecha', { mode: 'string' }).notNull(),
    motivo: text('motivo'),
    estado: text('estado').notNull().default('registrado'),
    anuladoEn: timestamp('anulado_en', { withTimezone: true }),
    anuladoPor: text('anulado_por'),
    motivoAnulacion: text('motivo_anulacion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_adelantos_empresa_id').on(t.tenantId, t.id),
    unique('personal_adelantos_numero').on(t.tenantId, t.anio, t.numero),
    foreignKey({ name: 'adelantos_colaborador_fk', columns: [t.tenantId, t.colaboradorId], foreignColumns: [personalColaboradores.tenantId, personalColaboradores.id] }),
    check('adelanto_monto', sql`${t.montoCentimos} > 0`),
    check('adelanto_estado', sql`${t.estado} IN ('registrado', 'anulado')`),
    check('adelanto_anulacion', sql`(${t.estado} = 'anulado') = (${t.anuladoEn} is not null)`),
    index('idx_personal_adelantos_colaborador').on(t.tenantId, t.colaboradorId, t.fecha.desc()),
    index('idx_personal_adelantos_fecha').on(t.tenantId, t.fecha.desc(), t.id.desc()),
  ],
);
