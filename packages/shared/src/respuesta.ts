import { z } from 'zod';
import { CODIGOS, type Codigo } from './codigos.js';

// Contrato de respuesta de toda operación (el de Cotizín, con tres formas): éxito con avisos y
// recibo, rechazo con candidatas opcionales, y «pide confirmación» para las acciones críticas.

/** `interno` solo lo ve quien tiene permiso de ver costos; `comercial`, cualquiera. */
export const avisoSchema = z.strictObject({
  codigo: z.string(),
  mensaje: z.string(),
  nivel: z.enum(['comercial', 'interno']),
});
export type Aviso = z.infer<typeof avisoSchema>;

/** Una fila entre las que no se pudo elegir. Nunca lleva costos. */
export const candidataSchema = z.strictObject({
  id: z.string(),
  numero: z.number().optional(),
  nombre: z.string(),
  detalle: z.string().optional(),
});
export type Candidata = z.infer<typeof candidataSchema>;

export const reciboSchema = z.strictObject({
  comercial: z.record(z.string(), z.unknown()),
  interno: z.record(z.string(), z.unknown()).optional(),
});
export type Recibo = z.infer<typeof reciboSchema>;

const codigoSchema = z.enum(Object.keys(CODIGOS) as [Codigo, ...Codigo[]]);

export const errorSchema = z.strictObject({
  codigo: codigoSchema,
  mensaje: z.string(),
  candidatas: z.array(candidataSchema).optional(),
});
export type ErrorDeRespuesta = z.infer<typeof errorSchema>;

export const pideConfirmacionSchema = z.strictObject({
  resumen: z.string(),
  token: z.string(),
  venceEn: z.iso.datetime(),
});
export type PideConfirmacion = z.infer<typeof pideConfirmacionSchema>;

export type Respuesta<S> =
  | { ok: true; datos: S; recibo?: Recibo; avisos: Aviso[] }
  | { ok: false; error: ErrorDeRespuesta }
  | { ok: false; requiereConfirmacion: PideConfirmacion };

/** Esquema de una respuesta cuyo `datos` cumple `datos`. Lo usan la API (salida) y la web (entrada). */
export function respuestaSchema<S extends z.ZodType>(datos: S) {
  return z.union([
    z.strictObject({
      ok: z.literal(true),
      datos,
      recibo: reciboSchema.optional(),
      avisos: z.array(avisoSchema),
    }),
    z.strictObject({ ok: z.literal(false), error: errorSchema }),
    z.strictObject({ ok: z.literal(false), requiereConfirmacion: pideConfirmacionSchema }),
  ]);
}

export function exito<S>(
  datos: S,
  extra: { recibo?: Recibo; avisos?: Aviso[] } = {},
): Respuesta<S> {
  return { ok: true, datos, recibo: extra.recibo, avisos: extra.avisos ?? [] };
}

export function rechazo(
  codigo: Codigo,
  mensaje: string,
  candidatas?: Candidata[],
): { ok: false; error: ErrorDeRespuesta } {
  return { ok: false, error: candidatas ? { codigo, mensaje, candidatas } : { codigo, mensaje } };
}
