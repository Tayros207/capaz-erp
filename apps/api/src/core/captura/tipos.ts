import type { z } from 'zod';
import type { NombreDeHerramienta, OrigenDeCaptura, SugerenciaDeCaptura } from '@capaz/shared';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

export type PropuestaInterpretada = {
  herramienta: NombreDeHerramienta;
  /** Pueden venir incompletos: se validan al aprobar. */
  args: Record<string, unknown>;
  resumen: string;
  sugerencias?: SugerenciaDeCaptura[];
};

export type DictadoInterpretado = { propuestas: PropuestaInterpretada[]; faltan: string[]; pista: string | null };

export type EntradaDeInterprete = {
  texto: string;
  origen: OrigenDeCaptura;
  modo?: 'ingreso' | 'egreso';
  /** Lo que extrajo el modelo; `null` en A1. */
  extraccion: unknown | null;
};

export type InterpreteDeCaptura = {
  /** Código del módulo dueño de las herramientas que propone. */
  modulo: string;
  /** Otros módulos cuyas herramientas también puede proponer; la persona debe poder escribir en ellos. */
  tambienPropone?: readonly string[];
  /** Solo lee (R19). `ctx` es el de la PERSONA que dicta, no el de sistema. */
  interpretar(tx: Transaccion, ctx: ContextoDeHerramienta, e: EntradaDeInterprete): Promise<DictadoInterpretado>;
  /** Solo A2. */
  esquemaParaModelo?: z.ZodType;
  instrucciones?: string;
};
