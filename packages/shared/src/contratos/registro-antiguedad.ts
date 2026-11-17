import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Antigüedad de saldos (cuentas por cobrar y por pagar): cuánto se debe por contacto y hace cuánto venció, por tramos.

export const TRAMOS_DE_ANTIGUEDAD = ['vigente', 'de_1_a_30', 'de_31_a_60', 'de_61_a_90', 'mas_de_90'] as const;
export type TramoDeAntiguedad = (typeof TRAMOS_DE_ANTIGUEDAD)[number];

const centimos = z.number().int();

const tramosSchema = z.strictObject({
  vigenteCentimos: centimos,
  de1a30Centimos: centimos,
  de31a60Centimos: centimos,
  de61a90Centimos: centimos,
  masDe90Centimos: centimos,
  totalCentimos: centimos,
});

export const filaDeAntiguedadSchema = z.strictObject({
  contactoId: z.string(),
  contactoNombre: z.string(),
  deudas: z.number().int(),
  ...tramosSchema.shape,
});
export type FilaDeAntiguedadDto = z.infer<typeof filaDeAntiguedadSchema>;

export const antiguedadSchema = z.strictObject({
  tipo: z.enum(['por_cobrar', 'por_pagar']),
  fecha: z.string(),
  filas: z.array(filaDeAntiguedadSchema),
  totales: tramosSchema,
});
export type AntiguedadDto = z.infer<typeof antiguedadSchema>;

export const pedirAntiguedadSchema = z.strictObject({
  tipo: z.enum(['por_cobrar', 'por_pagar']).default('por_cobrar'),
  /** Día de corte (AAAA-MM-DD); por defecto, hoy. */
  fecha: z.iso.date().optional(),
});

export const contratosDeRegistroAntiguedad = { deudas_antiguedad: contrato(pedirAntiguedadSchema, antiguedadSchema) } as const;
