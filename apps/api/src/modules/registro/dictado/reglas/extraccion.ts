import { z } from 'zod'
import { CATEGORIAS_EGRESO, CATEGORIAS_INGRESO } from './categorias-de-rubro.js'

/**
 * Categoria contable. Opcional y nullable a proposito: si el LLM no la
 * devuelve, el parser local la infiere y, si tampoco puede, el movimiento se
 * guarda sin clasificar. Nada del flujo actual depende de que venga.
 */
const categoriaSchema = z.enum([...CATEGORIAS_EGRESO, ...CATEGORIAS_INGRESO]).nullable().optional()

export const extraccionSchema = z.object({
  tipo: z.enum(['ingreso', 'egreso']).nullable(),
  monto_centimos: z.number().int().positive().nullable(),
  adelanto_centimos: z.number().int().positive().nullable().optional(),
  contacto_nombre: z.string().min(1).nullable(),
  contacto_tipo: z.enum(['cliente', 'proveedor', 'ambos']).nullable(),
  descripcion: z.string().nullable(),
  categoria: categoriaSchema,
  es_abono: z.boolean().default(false),
  es_consulta: z.boolean().default(false),
  es_proforma: z.boolean().default(false),
  comando: z.string().nullable(),
})

export type Extraccion = z.infer<typeof extraccionSchema>
