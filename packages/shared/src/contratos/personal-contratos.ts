import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Personal · contratos de trabajo y vacaciones (0028). La remuneración es dato sensible: no viaja en eventos ni en auditoría.

export const TIPOS_DE_CONTRATO = ['indeterminado', 'plazo_fijo', 'locacion', 'practicas'] as const;
export type TipoDeContrato = (typeof TIPOS_DE_CONTRATO)[number];
export const ESTADOS_DE_CONTRATO = ['vigente', 'terminado'] as const;
export const FILTROS_DE_CONTRATOS = ['vigentes', 'terminados', 'todos'] as const;

export const ESTADOS_DE_VACACIONES = ['solicitada', 'aprobada', 'rechazada', 'anulada'] as const;
export type EstadoDeVacaciones = (typeof ESTADOS_DE_VACACIONES)[number];
export const FILTROS_DE_VACACIONES = ['abiertas', ...ESTADOS_DE_VACACIONES, 'todas'] as const;
export const DECISIONES_DE_VACACIONES = ['aprobar', 'rechazar'] as const;

const texto = (max: number) => z.string().trim().max(max);
const id = z.uuid();
const soloId = z.strictObject({ id });
const dia = z.iso.date();

export const contratoDeTrabajoSchema = z.strictObject({
  id: z.string(),
  colaboradorId: z.string(),
  colaboradorNombre: z.string(),
  tipo: z.enum(TIPOS_DE_CONTRATO),
  inicio: z.string(),
  fin: z.string().nullable(),
  remuneracionMensualCentimos: z.number().int(),
  jornadaHorasSemana: z.number().int(),
  estado: z.enum(ESTADOS_DE_CONTRATO),
  terminadoEn: z.string().nullable(),
  motivoTermino: z.string().nullable(),
  creadoEn: z.iso.datetime(),
});
export type ContratoDeTrabajoDto = z.infer<typeof contratoDeTrabajoSchema>;

export const crearContratoSchema = z.strictObject({
  colaboradorId: id,
  tipo: z.enum(TIPOS_DE_CONTRATO),
  inicio: dia,
  fin: dia.optional(),
  remuneracionMensualCentimos: z.number().int().safe().min(0, { error: 'La remuneración no puede ser negativa.' }),
  jornadaHorasSemana: z.number().int().min(1).max(84).default(48),
});
export const terminarContratoSchema = z.strictObject({ id, fecha: dia.optional(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });
export const listarContratosSchema = z.strictObject({ ...paginaSchema.shape, estado: z.enum(FILTROS_DE_CONTRATOS).default('vigentes'), colaboradorId: id.optional() });

export const vacacionesSchema = z.strictObject({
  id: z.string(),
  colaboradorId: z.string(),
  colaboradorNombre: z.string(),
  desde: z.string(),
  hasta: z.string(),
  dias: z.number().int(),
  estado: z.enum(ESTADOS_DE_VACACIONES),
  motivo: z.string().nullable(),
  resueltoPor: z.string().nullable(),
  resueltoEn: z.iso.datetime().nullable(),
  motivoResolucion: z.string().nullable(),
  creadoEn: z.iso.datetime(),
});
export type VacacionesDto = z.infer<typeof vacacionesSchema>;

export const solicitarVacacionesSchema = z.strictObject({ colaboradorId: id, desde: dia, hasta: dia, motivo: texto(300).optional() });
export const resolverVacacionesSchema = z
  .strictObject({ id, decision: z.enum(DECISIONES_DE_VACACIONES), motivo: texto(300).optional() })
  .refine((v) => v.decision === 'aprobar' || Boolean(v.motivo), { error: 'Indica el motivo del rechazo.' });
export const anularVacacionesSchema = z.strictObject({ id, motivo: texto(300).min(1, { error: 'Indica el motivo.' }) });
export const listarVacacionesSchema = z.strictObject({ ...paginaSchema.shape, estado: z.enum(FILTROS_DE_VACACIONES).default('abiertas'), colaboradorId: id.optional() });

export const saldoDeVacacionesSchema = z.strictObject({
  colaboradorId: z.string(),
  fechaIngreso: z.string().nullable(),
  corte: z.string(),
  devengadosDias: z.number().int(),
  gozadosDias: z.number().int(),
  porAprobarDias: z.number().int(),
  saldoDias: z.number().int(),
});
export type SaldoDeVacacionesDto = z.infer<typeof saldoDeVacacionesSchema>;

export const contratosDePersonalContratos = {
  contrato_crear: contrato(crearContratoSchema, contratoDeTrabajoSchema),
  contrato_terminar: contrato(terminarContratoSchema, contratoDeTrabajoSchema),
  contratos_listar: contrato(listarContratosSchema, listadoSchema(contratoDeTrabajoSchema)),
  vacaciones_solicitar: contrato(solicitarVacacionesSchema, vacacionesSchema),
  vacaciones_resolver: contrato(resolverVacacionesSchema, vacacionesSchema),
  vacaciones_anular: contrato(anularVacacionesSchema, vacacionesSchema),
  vacaciones_listar: contrato(listarVacacionesSchema, listadoSchema(vacacionesSchema)),
  vacaciones_saldo: contrato(z.strictObject({ colaboradorId: id, fecha: dia.optional() }), saldoDeVacacionesSchema),
} as const;

export const eventosDePersonalContratos = {
  'vacaciones.resuelta': z.strictObject({ id: z.string(), decision: z.enum(DECISIONES_DE_VACACIONES) }),
} as const;
