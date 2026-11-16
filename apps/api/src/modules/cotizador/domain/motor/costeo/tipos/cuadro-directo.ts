import { z } from 'zod'
import type { HallazgoDeReferencias } from '../../escala/tipos/precio-por-escala.js'
import { CANTIDADES_DE_REFERENCIA } from '../../base/cantidades-de-referencia.js'
import { FACTORES, type BaseDeUtilidad, type Factor } from '../../base/dominio.js'
import { esIgual } from '../../base/dinero.js'
import { importeSchema, porcentajeSchema, soloSiNoHayErrores } from '../../base/esquemas-decimales.js'
import type { LineaDeImpuesto } from '../../base/impuesto.js'
import { normalizarTexto } from '../../base/texto.js'
import type { Calculo } from './cotizacion.js'

// El cuadro de costos directo (PRP-007): tres columnas fijas, importes escritos a mano, ítems propios
// de la empresa, utilidad por columna y qué columnas se envían al cliente. Lo escrito vive dentro del
// `Cuadro` (campo `directo`, opcional) y lo calcula el motor de `services/cuadro-directo.ts`.

/** Las tres columnas del cuadro son las tres cantidades de referencia (R1 del PRP-007). */
export const COLUMNAS = CANTIDADES_DE_REFERENCIA
export type Columna = (typeof COLUMNAS)[number]
export const columnaSchema = z.enum(COLUMNAS)

/** La columna (y cantidad del trabajo) con la que nace un cuadro nuevo. */
export const COLUMNA_BASE_POR_DEFECTO: Columna = '1000'

/** Las filas base que nacen marcadas como fijas: cuestan lo mismo a 100 que a 5.000 (R5). */
export const FILAS_FIJAS_POR_DEFECTO = ['planchas', 'diseno'] as const satisfies readonly Factor[]

/** La columna que corresponde a una cantidad (por valor: «1000.0» es la de 1.000), o `null` si no es una de las tres. */
export const columnaDe = (cantidad: string): Columna | null => COLUMNAS.find((c) => esIgual(c, cantidad)) ?? null

/** Solo las celdas escritas a mano: una clave ausente significa «sale del detalle (o cero)». */
export const celdasSchema = z.strictObject({
  '100': importeSchema.optional(),
  '1000': importeSchema.optional(),
  '5000': importeSchema.optional(),
})
export type Celdas = z.infer<typeof celdasSchema>

/** Lo escrito a mano de una fila base; `fija` es una comodidad de escritura (R5), el motor no la mira. */
export const filaDirectaSchema = z.strictObject({ celdas: celdasSchema, fija: z.boolean() })
export type FilaDirecta = z.infer<typeof filaDirectaSchema>

/** Tope de ítems adicionales de una cotización: un guardarraíl, como `MAX_LINEAS`. */
export const MAX_ITEMS_DEL_CUADRO = 12

/**
 * Un ítem adicional del cuadro (R6): una fila con nombre propio que suma a un factor base (`factor`) y
 * se pinta tras otra fila base (`despuesDe`). No tiene detalle: se escribe a mano.
 */
export const itemDelCuadroSchema = z.strictObject({
  id: z.string().min(1).max(64),
  nombre: z.string().trim().min(1, { error: 'Falta el nombre del ítem.' }).max(60),
  factor: z.enum(FACTORES),
  despuesDe: z.enum(FACTORES),
  celdas: celdasSchema,
  fija: z.boolean(),
})
export type ItemDelCuadro = z.infer<typeof itemDelCuadroSchema>

export const directoSchema = z
  .strictObject({
    /** Lo escrito a mano de las filas base; un factor sin clave no tiene nada escrito. */
    factores: z.partialRecord(z.enum(FACTORES), filaDirectaSchema),
    items: z.array(itemDelCuadroSchema).max(MAX_ITEMS_DEL_CUADRO),
    /** Utilidad por columna, sobre la base de la cotización; sin clave rige la utilidad general. */
    utilidadPct: z.partialRecord(columnaSchema, porcentajeSchema),
    /** Las columnas que se envían al cliente; siempre incluye la base (R11). */
    enviar: z.array(columnaSchema).max(COLUMNAS.length),
    /** Contador de ids de ítem: sube siempre, para no reutilizar el id de uno quitado. */
    siguienteItem: z.number().int().min(1),
  })
  .refine((d) => new Set(d.enviar).size === d.enviar.length, {
    error: 'Una columna no puede estar dos veces entre las que se envían.',
    path: ['enviar'],
    ...soloSiNoHayErrores,
  })
  .refine((d) => new Set(d.items.map((i) => normalizarTexto(i.nombre))).size === d.items.length, {
    error: 'Hay dos ítems con el mismo nombre.',
    path: ['items'],
    ...soloSiNoHayErrores,
  })
  .refine((d) => new Set(d.items.map((i) => i.id)).size === d.items.length, {
    error: 'Hay dos ítems con el mismo identificador.',
    path: ['items'],
    ...soloSiNoHayErrores,
  })
export type Directo = z.infer<typeof directoSchema>

/** Lo que vale un cuadro sin `directo` (los guardados antes del PRP-007): nada escrito a mano. */
export function directoVacio(base: Columna | null): Directo {
  return { factores: {}, items: [], utilidadPct: {}, enviar: base ? [base] : [], siguienteItem: 1 }
}

// ---------------------------------------------------------------------------------------------
// Lo que calcula el motor (Fase 2). Se declara aquí porque la foto de una emisión lo guarda.
// ---------------------------------------------------------------------------------------------

export type OrigenDeCelda = 'mano' | 'detalle' | 'deducida' | 'vacia' | 'no_calculable'

export type CeldaCalculada = {
  /** Importe con 2 decimales; `null` si no se pudo calcular. */
  valor: string | null
  origen: OrigenDeCelda
  /** Lo que da el detalle de la fila a esa cantidad, aunque haya algo escrito a mano encima. */
  delDetalle: string | null
  /** Por qué no se pudo calcular, si `origen` es `no_calculable`. */
  motivo: string | null
  /** La columna escrita a mano de la que se dedujo, si `origen` es `deducida`. */
  desde?: Columna
}

export type FilaCalculada = {
  /** El factor (fila base) o el id del ítem. */
  clave: string
  nombre: string
  esItem: boolean
  /** El factor al que suma: el propio en una fila base. */
  factor: Factor
  fija: boolean
  celdas: Record<Columna, CeldaCalculada>
}

export type ColumnaCalculada = {
  cantidad: Columna
  esBase: boolean
  seEnvia: boolean
  /** Falsa si alguna celda no se pudo calcular: entonces no hay `calculo`. */
  completa: boolean
  motivo: string | null
  calculo: Calculo | null
  utilidad: { pct: string; deColumna: boolean; base: BaseDeUtilidad; equivalentePct: string }
  impuesto: LineaDeImpuesto
  totalConImpuesto: string | null
}

export type CuadroDirectoCalculado = {
  /** La columna de la cantidad del trabajo; `null` si esa cantidad no es una de las tres. */
  base: Columna | null
  /** Las filas en el orden del cuadro, con los ítems intercalados tras su fila base. */
  filas: FilaCalculada[]
  columnas: Record<Columna, ColumnaCalculada>
  /** Invariantes A y B sobre los tres totales; `null` si alguna columna está incompleta. */
  coherencia: { bloqueos: HallazgoDeReferencias[]; avisos: HallazgoDeReferencias[] } | null
}
