import { sql } from 'drizzle-orm';
import { bigint, check, date, foreignKey, index, integer, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { personal, personalColaboradores } from './personal.js';

// Personal · contratos y vacaciones (0028). Datos personales y de remuneración: nunca en eventos ni en auditoría.

/** El vínculo de un colaborador con la empresa. Solo uno vigente por colaborador; al terminarlo queda en el historial. */
export const personalContratos = personal.table(
  'contratos',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    colaboradorId: uuid('colaborador_id').notNull(),
    tipo: text('tipo').notNull(),
    inicio: date('inicio', { mode: 'string' }).notNull(),
    fin: date('fin', { mode: 'string' }),
    remuneracionMensualCentimos: bigint('remuneracion_mensual_centimos', { mode: 'number' }).notNull().default(0),
    jornadaHorasSemana: integer('jornada_horas_semana').notNull().default(48),
    estado: text('estado').notNull().default('vigente'),
    terminadoEn: date('terminado_en', { mode: 'string' }),
    motivoTermino: text('motivo_termino'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_contratos_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'contratos_colaborador_fk', columns: [t.tenantId, t.colaboradorId], foreignColumns: [personalColaboradores.tenantId, personalColaboradores.id] }),
    check('contrato_tipo', sql`${t.tipo} IN ('indeterminado', 'plazo_fijo', 'locacion', 'practicas')`),
    check('contrato_estado', sql`${t.estado} IN ('vigente', 'terminado')`),
    check('contrato_fechas', sql`${t.fin} is null or ${t.fin} >= ${t.inicio}`),
    check('contrato_plazo', sql`${t.tipo} not in ('plazo_fijo', 'practicas') or ${t.fin} is not null`),
    check('contrato_remuneracion', sql`${t.remuneracionMensualCentimos} >= 0`),
    check('contrato_jornada', sql`${t.jornadaHorasSemana} between 1 and 84`),
    check('contrato_termino', sql`(${t.estado} = 'terminado') = (${t.terminadoEn} is not null)`),
    uniqueIndex('uq_personal_contratos_vigente').on(t.tenantId, t.colaboradorId).where(sql`${t.estado} = 'vigente'`),
    index('idx_personal_contratos_colaborador').on(t.tenantId, t.colaboradorId, t.inicio.desc()),
  ],
);

/** Una solicitud de vacaciones: pasa a aprobada o rechazada; solo las aprobadas descuentan del saldo. */
export const personalVacaciones = personal.table(
  'vacaciones',
  {
    id: uuid('id').primaryKey().default(sql`uuidv7()`),
    tenantId: text('tenant_id').notNull(),
    colaboradorId: uuid('colaborador_id').notNull(),
    desde: date('desde', { mode: 'string' }).notNull(),
    hasta: date('hasta', { mode: 'string' }).notNull(),
    dias: integer('dias').notNull(),
    estado: text('estado').notNull().default('solicitada'),
    motivo: text('motivo'),
    resueltoPor: text('resuelto_por'),
    resueltoEn: timestamp('resuelto_en', { withTimezone: true }),
    motivoResolucion: text('motivo_resolucion'),
    creadoPor: text('creado_por').notNull(),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp('actualizado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('personal_vacaciones_empresa_id').on(t.tenantId, t.id),
    foreignKey({ name: 'vacaciones_colaborador_fk', columns: [t.tenantId, t.colaboradorId], foreignColumns: [personalColaboradores.tenantId, personalColaboradores.id] }),
    check('vacaciones_estado', sql`${t.estado} IN ('solicitada', 'aprobada', 'rechazada', 'anulada')`),
    check('vacaciones_fechas', sql`${t.hasta} >= ${t.desde}`),
    check('vacaciones_dias', sql`${t.dias} between 1 and 366`),
    check('vacaciones_resolucion', sql`(${t.estado} in ('aprobada', 'rechazada')) = (${t.resueltoEn} is not null) or ${t.estado} = 'anulada'`),
    index('idx_personal_vacaciones_colaborador').on(t.tenantId, t.colaboradorId, t.desde.desc()),
    index('idx_personal_vacaciones_estado').on(t.tenantId, t.estado, t.desde),
  ],
);
