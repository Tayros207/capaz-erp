import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Fusión de clientes y proveedores duplicados: detectar parecidos y reunir en uno solo todo lo que apuntaba al repetido.

export const UMBRAL_DE_PARECIDO_POR_DEFECTO = 0.55;

const id = z.uuid();

export const parecidoDeClienteSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  documentoNumero: z.string().nullable(),
  tipo: z.enum(['cliente', 'proveedor', 'ambos']),
});

export const parSimilarSchema = z.strictObject({ a: parecidoDeClienteSchema, b: parecidoDeClienteSchema, similitud: z.number() });
export type ParSimilarDto = z.infer<typeof parSimilarSchema>;

export const similaresPedidoSchema = z.strictObject({
  umbral: z.number().min(0.3).max(0.95).default(UMBRAL_DE_PARECIDO_POR_DEFECTO),
  limite: z.number().int().min(1).max(50).default(20),
});

export const fusionarPedidoSchema = z.strictObject({ origenId: id, destinoId: id });

export const referenciaReasignadaSchema = z.strictObject({ tabla: z.string(), filas: z.number().int() });

export const fusionSchema = z.strictObject({
  destinoId: z.string(),
  origenId: z.string(),
  reasignadas: z.array(referenciaReasignadaSchema),
  /** Historial de solo inserción (p. ej. movimientos de dinero): conserva el nombre anterior y no se mueve. */
  conservadas: z.array(referenciaReasignadaSchema),
  totalFilas: z.number().int(),
});
export type FusionDto = z.infer<typeof fusionSchema>;

export const contratosDeClientesFusion = {
  clientes_similares: contrato(similaresPedidoSchema, z.strictObject({ items: z.array(parSimilarSchema) })),
  clientes_fusionar: contrato(fusionarPedidoSchema, fusionSchema),
} as const;

export const eventosDeClientesFusion = {
  'cliente.fusionado': z.strictObject({ origenId: z.string(), destinoId: z.string(), filas: z.number().int() }),
} as const;
