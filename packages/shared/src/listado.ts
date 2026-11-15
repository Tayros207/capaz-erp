import { z } from 'zod';

/** Parámetros de paginación de toda herramienta `*_listar`. */
export const paginaSchema = z.strictObject({
  limite: z.number().int().min(1).max(100).default(25),
  cursor: z.string().max(200).optional(),
});
export type Pagina = z.infer<typeof paginaSchema>;

export const listadoSchema = <T extends z.ZodType>(item: T) =>
  z.strictObject({ items: z.array(item), siguiente: z.string().nullable() });
