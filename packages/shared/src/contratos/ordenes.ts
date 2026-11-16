import { z } from 'zod';
// Contratos del área «ordenes»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
export const contratosDeOrdenes = {} as const;
export const eventosDeOrdenes = {
  'pedido.confirmado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), totalCentimos: z.number().int(), entregaEl: z.iso.date().nullable(), sucursalId: z.string().nullable() }),
  'pedido.entregado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string() }),
  'pedido.cancelado': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), teniaNumero: z.boolean() }),
} as const;
