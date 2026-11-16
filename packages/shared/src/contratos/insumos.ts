// Contratos del área «insumos»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';

export const contratosDeInsumos = {} as const;

export const eventosDeInsumos = {
  'existencia.bajo_minimo': z.strictObject({ articuloId: z.string(), sucursalId: z.string(), cantidadMilesimas: z.number().int(), minimoMilesimas: z.number().int() }),
  'existencia.movida': z.strictObject({ articuloId: z.string(), sucursalId: z.string(), tipo: z.enum(['entrada', 'salida', 'ajuste']), cantidadMilesimas: z.number().int() }),
} as const;
