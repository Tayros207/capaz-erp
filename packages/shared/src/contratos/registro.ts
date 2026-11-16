import { z } from 'zod';
// Contratos del área «registro»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
export const contratosDeRegistro = {} as const;
export const eventosDeRegistro = {
  'movimiento.registrado': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['ingreso', 'egreso']), montoCentimos: z.number().int(), fecha: z.iso.date(), cuentaId: z.string(), contactoId: z.string().nullable(), deudaId: z.string().nullable() }),
  'movimiento.anulado': z.strictObject({ id: z.string(), codigo: z.string(), deudaId: z.string().nullable() }),
  'deuda.creada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int(), venceEn: z.iso.date().nullable(), origenTipo: z.string().nullable(), origenId: z.string().nullable() }),
  'deuda.abonada': z.strictObject({ id: z.string(), codigo: z.string(), movimientoId: z.string(), montoCentimos: z.number().int(), saldoCentimos: z.number().int() }),
  'deuda.pagada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int() }),
  'deuda.anulada': z.strictObject({ id: z.string(), codigo: z.string() }),
} as const;
