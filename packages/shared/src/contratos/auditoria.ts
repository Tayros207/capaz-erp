import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «auditoria»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const RESULTADOS_DE_AUDITORIA = ['ok', 'rechazada', 'pendiente_confirmacion'] as const;

export const listarAuditoriaSchema = z.strictObject({
  ...paginaSchema.shape,
  herramienta: z.string().trim().min(1).max(100).optional(),
  entidadTipo: z.string().trim().min(1).max(100).optional(),
  entidadId: z.string().trim().min(1).max(100).optional(),
  resultado: z.enum(RESULTADOS_DE_AUDITORIA).optional(),
});
export type ListarAuditoria = z.infer<typeof listarAuditoriaSchema>;

/** Nunca lleva argumentos: solo lo que cada herramienta declaró como seguro. */
export const eventoDeAuditoriaSchema = z.strictObject({
  id: z.string(),
  usuarioId: z.string(),
  modulo: z.string(),
  herramienta: z.string(),
  canal: z.string(),
  resultado: z.enum(RESULTADOS_DE_AUDITORIA),
  codigo: z.string().nullable(),
  entidadTipo: z.string().nullable(),
  entidadId: z.string().nullable(),
  resumen: z.record(z.string(), z.unknown()),
  requestId: z.string(),
  duracionMs: z.number().int(),
  creadoEn: z.iso.datetime(),
});
export type EventoDeAuditoria = z.infer<typeof eventoDeAuditoriaSchema>;

export const contratosDeAuditoria = {
  auditoria_listar: contrato(listarAuditoriaSchema, listadoSchema(eventoDeAuditoriaSchema)),
} as const;
export const eventosDeAuditoria = {} as const;
