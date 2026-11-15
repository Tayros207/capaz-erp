import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Contratos del área «modulos»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const solicitarModuloSchema = z.strictObject({
  modulo: z.string().trim().min(1).max(50),
  nota: z.string().trim().max(500).optional(),
});
export type SolicitarModulo = z.infer<typeof solicitarModuloSchema>;

export const solicitudDeModuloSchema = z.strictObject({
  id: z.string(),
  modulo: z.string(),
  estado: z.enum(['pendiente', 'atendida', 'descartada']),
  /** Verdadero si ya había una solicitud pendiente de ese módulo: no se duplica. */
  yaSolicitado: z.boolean(),
});
export type SolicitudDeModulo = z.infer<typeof solicitudDeModuloSchema>;

export const contratosDeModulos = {
  modulo_solicitar: contrato(solicitarModuloSchema, solicitudDeModuloSchema),
} as const;
export const eventosDeModulos = {} as const;
