import { z } from 'zod';

// Contrato de la ruta de salud: lo usan la API (para responder) y la web (para validar lo recibido).
export const healthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  database: z.enum(['up', 'down', 'not-configured']),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
