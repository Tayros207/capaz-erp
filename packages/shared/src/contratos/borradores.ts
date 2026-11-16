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

export const contratosDeBorradores = {
  borradores_listar: contrato(listarBorradoresSchema, listadoSchema(borradorSchema)),
  borrador_ver: contrato(verBorradorSchema, borradorSchema),
  borrador_corregir: contrato(corregirBorradorSchema, borradorSchema),
  borrador_aprobar: contrato(aprobarBorradorSchema, borradorAprobadoSchema),
  borrador_descartar: contrato(descartarBorradorSchema, borradorSchema),
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
