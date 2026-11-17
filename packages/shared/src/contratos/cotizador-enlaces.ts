import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { ESTADOS_DE_COTIZACION } from './cotizador.js';

// Contratos del enlace público de una cotización (B3): tres herramientas. El token completo solo viaja en la
// respuesta de `enlace_generar`; después en la base queda únicamente su sha256.

export const DIAS_DE_VIGENCIA_POR_DEFECTO = 30;
export const ESTADOS_DE_ENLACE = ['vigente', 'vencido', 'revocado'] as const;

export const enlaceDeCotizacionSchema = z.strictObject({
  id: z.string(),
  cotizacionId: z.string(),
  version: z.number().int(),
  estado: z.enum(ESTADOS_DE_ENLACE),
  venceEn: z.iso.datetime(),
  revocadoEn: z.iso.datetime().nullable(),
  vistas: z.number().int(),
  ultimaVistaEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
});
export type EnlaceDeCotizacionDto = z.infer<typeof enlaceDeCotizacionSchema>;

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeCotizadorEnlaces = {
  enlace_generar: contrato(
    z.strictObject({ id: z.uuid(), diasDeVigencia: z.number().int().min(1, { error: 'Mínimo 1 día.' }).max(365, { error: 'Máximo 365 días.' }).default(DIAS_DE_VIGENCIA_POR_DEFECTO) }),
    z.strictObject({
      enlace: enlaceDeCotizacionSchema,
      /** El enlace completo: se muestra una sola vez, no se puede volver a ver. */
      url: z.string(),
      codigo: z.string(),
      estadoDeLaCotizacion: z.enum(ESTADOS_DE_COTIZACION),
    }),
  ),
  enlaces_listar: contrato(z.strictObject({ cotizacionId: z.uuid() }), z.strictObject({ items: z.array(enlaceDeCotizacionSchema) })),
  enlace_revocar: contrato(soloId, enlaceDeCotizacionSchema),
} as const;
