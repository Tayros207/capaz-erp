import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «borradores»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const ORIGENES_DE_BORRADOR = ['voz', 'texto', 'agente', 'regla', 'conector', 'importacion', 'modulo'] as const;
export const PRIORIDADES_DE_BORRADOR = ['normal', 'alta'] as const;
export const ESTADOS_DE_BORRADOR = ['pendiente', 'aprobado', 'descartado'] as const;

const idSchema = z.uuid({ error: 'El identificador del borrador no es válido.' });

/** Un borrador es una llamada a herramienta pendiente: no toca los datos del negocio hasta aprobarse. */
export const borradorSchema = z.strictObject({
  id: z.string(),
  herramienta: z.string(),
  modulo: z.string(),
  /** Lo que se ejecutará al aprobar; puede estar incompleto (se valida al aprobar). */
  args: z.unknown(),
  argsOriginales: z.unknown(),
  resumen: z.string(),
  origen: z.enum(ORIGENES_DE_BORRADOR),
  origenRef: z.string().nullable(),
  prioridad: z.enum(PRIORIDADES_DE_BORRADOR),
  estado: z.enum(ESTADOS_DE_BORRADOR),
  corregido: z.boolean(),
  propuestoPor: z.string(),
  propuestoEn: z.iso.datetime(),
  capturaIniciadaEn: z.iso.datetime().nullable(),
  resueltoPor: z.string().nullable(),
  resueltoEn: z.iso.datetime().nullable(),
  motivoDescarte: z.string().nullable(),
});
export type Borrador = z.infer<typeof borradorSchema>;

export const listarBorradoresSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(ESTADOS_DE_BORRADOR).optional(),
  modulo: z.string().trim().min(1).max(100).optional(),
  origen: z.enum(ORIGENES_DE_BORRADOR).optional(),
});
export type ListarBorradores = z.infer<typeof listarBorradoresSchema>;

export const verBorradorSchema = z.strictObject({ id: idSchema });

export const corregirBorradorSchema = z.strictObject({
  id: idSchema,
  args: z.record(z.string(), z.unknown(), { error: 'Los datos corregidos deben ser un objeto.' }),
});

/** `confirmacion` se reenvía a la herramienta propuesta cuando es crítica. */
export const aprobarBorradorSchema = z.strictObject({
  id: idSchema,
  confirmacion: z.string().min(1).optional(),
});

export const descartarBorradorSchema = z.strictObject({
  id: idSchema,
  motivo: z.string().trim().min(1, { error: 'Indica por qué se descarta.' }).max(500),
});

export const borradorAprobadoSchema = z.strictObject({
  borrador: borradorSchema,
  /** Lo que respondió la herramienta propuesta. */
  resultado: z.unknown(),
});

/** Lo que espera a la persona: borradores pendientes de módulos a los que puede entrar. */
export const resumenDeBorradoresSchema = z.strictObject({
  pendientes: z.number().int().nonnegative(),
  deAltaPrioridad: z.number().int().nonnegative(),
});
export type ResumenDeBorradores = z.infer<typeof resumenDeBorradoresSchema>;

export const MAXIMO_DE_DIAS_DE_METRICAS = 92;
/** Un borrador resuelto dentro de este plazo desde que empezó la captura cuenta como «en la misma sesión». */
export const SEGUNDOS_DE_MISMA_SESION = 600;

const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000) + 1;

export const pedirMetricasDeBorradoresSchema = z
  .strictObject({
    desde: z.iso.date(),
    hasta: z.iso.date(),
    origen: z.enum(['voz', 'texto']).optional(),
    modulo: z.string().trim().min(1).max(100).optional(),
  })
  .refine((v) => v.hasta >= v.desde, { error: 'La fecha final no puede ser anterior a la inicial.' })
  .refine((v) => v.hasta < v.desde || diasEntre(v.desde, v.hasta) <= MAXIMO_DE_DIAS_DE_METRICAS, { error: `Las métricas abarcan como máximo ${MAXIMO_DE_DIAS_DE_METRICAS} días.` });

export const metricasDeBorradoresSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  propuestos: z.number().int().nonnegative(),
  aprobadosSinCorregir: z.number().int().nonnegative(),
  aprobadosCorregidos: z.number().int().nonnegative(),
  descartados: z.number().int().nonnegative(),
  pendientes: z.number().int().nonnegative(),
  /** 0 a 100 con un decimal; `null` si todavía no hay ninguno resuelto. */
  pctSinCorregir: z.number().min(0).max(100).nullable(),
  /** Aprobados dentro de SEGUNDOS_DE_MISMA_SESION desde el inicio de la captura. */
  enLaMismaSesion: z.number().int().nonnegative(),
  /** Mediana, en segundos enteros, del inicio de la captura a la aprobación, solo de los de la misma sesión. */
  medianaSegundos: z.number().int().nonnegative().nullable(),
  /** Qué argumentos se corrigieron más (compara `args` con `argsOriginales`). */
  camposCorregidos: z.array(z.strictObject({ campo: z.string(), veces: z.number().int().positive() })),
});
export type MetricasDeBorradores = z.infer<typeof metricasDeBorradoresSchema>;

export const contratosDeBorradores = {
  borradores_resumen: contrato(z.strictObject({}), resumenDeBorradoresSchema),
  borradores_listar: contrato(listarBorradoresSchema, listadoSchema(borradorSchema)),
  borrador_ver: contrato(verBorradorSchema, borradorSchema),
  borrador_corregir: contrato(corregirBorradorSchema, borradorSchema),
  borrador_aprobar: contrato(aprobarBorradorSchema, borradorAprobadoSchema),
  borrador_descartar: contrato(descartarBorradorSchema, borradorSchema),
  borradores_metricas: contrato(pedirMetricasDeBorradoresSchema, metricasDeBorradoresSchema),
} as const;

export const eventosDeBorradores = {
  'borrador.propuesto': z.strictObject({
    id: z.string(),
    herramienta: z.string(),
    modulo: z.string(),
    origen: z.enum(ORIGENES_DE_BORRADOR),
    prioridad: z.enum(PRIORIDADES_DE_BORRADOR),
  }),
} as const;
