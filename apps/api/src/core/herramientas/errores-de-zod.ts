import { z } from 'zod';

/** Opciones de `safeParse` para que los mensajes por defecto de Zod salgan en español. */
export const OPCIONES_EN_ESPANOL = { error: z.locales.es().localeError };

/** Los problemas de un `ZodError` en una sola frase: «ruta: mensaje · ruta: mensaje». */
export function mensajeDeZod(error: z.ZodError): string {
  return error.issues
    .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
    .join(' · ');
}
