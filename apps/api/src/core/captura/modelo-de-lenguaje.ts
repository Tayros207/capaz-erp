import type { z } from 'zod';
import type { Transaccion } from '../../infra/database/con-empresa.js';

export interface ModeloDeLenguaje {
  /**
   * Lo que el modelo entendió de `texto`, YA validado con `esquema`, o `null` (sin modelo, sin presupuesto o respuesta que no sirve).
   * Nunca lanza: si devuelve `null`, el intérprete sigue con sus reglas. `tx` es la de la persona que dicta (tope y uso de su empresa).
   */
  extraer(esquema: z.ZodType, instrucciones: string, texto: string, tx: Transaccion): Promise<unknown>;
}

export const MODELO_DE_LENGUAJE = Symbol('MODELO_DE_LENGUAJE');

/** A1: no hay modelo. Siempre `null`, sin red, sin configuración (R20). */
export class ModeloNulo implements ModeloDeLenguaje {
  async extraer(): Promise<null> {
    return null;
  }
}
