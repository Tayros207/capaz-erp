// Contratos del área «personal»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';

export const contratosDePersonal = {} as const;

// Sin nombres ni documentos: solo ids y montos.
export const eventosDePersonal = {
  'adelanto.registrado': z.strictObject({ adelantoId: z.string(), colaboradorId: z.string(), montoCentimos: z.number().int(), fecha: z.iso.date() }),
  'adelanto.anulado': z.strictObject({ adelantoId: z.string(), colaboradorId: z.string(), montoCentimos: z.number().int() }),
} as const;
