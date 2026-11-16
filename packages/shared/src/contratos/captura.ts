import { z } from 'zod';
import { contrato } from '../herramientas.js';
import type { ORIGENES_DE_BORRADOR } from './borradores.js';

// Contratos del área «captura»: texto dictado o escrito → borradores. Solo el carril de esta área edita este archivo.

/** Por dónde entró el texto. Es también el `origen` del borrador (subconjunto de ORIGENES_DE_BORRADOR). */
export const ORIGENES_DE_CAPTURA = ['voz', 'texto'] as const satisfies readonly (typeof ORIGENES_DE_BORRADOR)[number][];
export type OrigenDeCaptura = (typeof ORIGENES_DE_CAPTURA)[number];
/** Módulos que tienen intérprete. Crece con cada intérprete nuevo. */
export const MODULOS_CON_DICTADO = ['registro'] as const;
/** El botón que tocó la persona antes de dictar; manda sobre lo que diga la frase. */
export const MODOS_DE_CAPTURA = ['ingreso', 'egreso'] as const;
export const INTERPRETES_DE_CAPTURA = ['reglas', 'modelo'] as const;
export const MAXIMO_DE_TEXTO_DE_CAPTURA = 500;
/** 15 minutos: lo más que puede pasar entre tocar el micrófono y enviar. */
export const MAXIMO_DE_ESPERA_DE_CAPTURA_MS = 900_000;
export const MAXIMO_DE_PROPUESTAS_POR_CAPTURA = 5;

export const capturaProponerSchema = z.strictObject({
  texto: z.string().trim().min(1, { error: 'Dicta o escribe algo.' }).max(MAXIMO_DE_TEXTO_DE_CAPTURA, { error: 'El texto es demasiado largo.' }),
  origen: z.enum(ORIGENES_DE_CAPTURA),
  /** Milisegundos entre que la persona tocó el micrófono (o empezó a escribir) y el envío. Lo mide el reloj del aparato. */
  transcurridoMs: z.number().int().min(0).max(MAXIMO_DE_ESPERA_DE_CAPTURA_MS),
  modulo: z.enum(MODULOS_CON_DICTADO).default('registro'),
  modo: z.enum(MODOS_DE_CAPTURA).optional(),
});

/** Un dato que el intérprete no pudo fijar solo: el campo, lo que se dictó y las opciones que encontró. */
export const sugerenciaDeCapturaSchema = z.strictObject({
  campo: z.string(),
  texto: z.string(),
  opciones: z.array(z.strictObject({ id: z.string(), nombre: z.string(), detalle: z.string().optional() })),
});
export type SugerenciaDeCaptura = z.infer<typeof sugerenciaDeCapturaSchema>;

export const propuestaDeCapturaSchema = z.strictObject({
  /** Id del borrador ya guardado en la bandeja. */
  id: z.string(),
  herramienta: z.string(),
  resumen: z.string(),
  args: z.unknown(),
  sugerencias: z.array(sugerenciaDeCapturaSchema),
});

export const capturaPropuestaSchema = z.strictObject({
  borradores: z.array(propuestaDeCapturaSchema),
  /** Lo que la persona debe completar o decidir, en palabras: «el monto», «si entró o salió». */
  faltan: z.array(z.string()),
  /** Ayuda para volver a dictar cuando no se entendió. */
  pista: z.string().nullable(),
  interpretadoCon: z.enum(INTERPRETES_DE_CAPTURA),
});
export type CapturaPropuesta = z.infer<typeof capturaPropuestaSchema>;

export const contratosDeCaptura = {
  captura_proponer: contrato(capturaProponerSchema, capturaPropuestaSchema),
} as const;
export const eventosDeCaptura = {} as const;
