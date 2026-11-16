import type { z } from 'zod';

export interface ModeloDeLenguaje {
  extraer(esquema: z.ZodType, instrucciones: string, texto: string): Promise<unknown | null>;
}

export const MODELO_DE_LENGUAJE = Symbol('MODELO_DE_LENGUAJE');

/** A1: no hay modelo. Siempre `null`, sin red, sin configuración (R20). */
export class ModeloNulo implements ModeloDeLenguaje {
  async extraer(): Promise<null> {
    return null;
  }
}
