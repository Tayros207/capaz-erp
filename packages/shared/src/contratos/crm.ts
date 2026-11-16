import { z } from 'zod';
// Contratos del área «crm»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
export const contratosDeCrm = {} as const;
export const eventosDeCrm = {
  'oportunidad.creada': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), etapaId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.movida': z.strictObject({ id: z.string(), codigo: z.string(), etapaId: z.string(), etapaAnteriorId: z.string() }),
  'oportunidad.ganada': z.strictObject({ id: z.string(), codigo: z.string(), titulo: z.string(), clienteId: z.string(), montoEstimadoCentimos: z.number().int().nullable() }),
  'oportunidad.perdida': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
} as const;
