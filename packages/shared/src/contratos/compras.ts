// Contratos del área «compras»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.
import { z } from 'zod';

export const contratosDeCompras = {} as const;

export const eventosDeCompras = {
  'compra.enviada': z.strictObject({ ordenId: z.string(), numero: z.string(), proveedorId: z.string(), totalCentimos: z.number().int() }),
  'compra.recibida': z.strictObject({
    ordenId: z.string(),
    recepcionId: z.string(),
    numero: z.string(),
    proveedorId: z.string(),
    totalRecibidoCentimos: z.number().int(),
    lineas: z.array(z.strictObject({ productoId: z.string().nullable(), cantidadMilesimas: z.number().int(), costoUnitarioMilesimas: z.number().int() })),
  }),
  'compra.cancelada': z.strictObject({ ordenId: z.string(), numero: z.string() }),
} as const;
