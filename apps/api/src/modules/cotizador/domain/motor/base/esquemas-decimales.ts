import { z } from 'zod'
import { esMayor } from './dinero.js'

type Precision = { enteros: number; decimales: number }

/**
 * Opción para todo `refine` que convierta texto a número con big.js: Zod 4 ejecuta los
 * refinamientos aunque un `regex` ya haya fallado, y big.js lanza con texto no numérico, así
 * que sin esto un valor «abc» reventaría `safeParse` en vez de dar un error de validación.
 */
export const soloSiNoHayErrores = { when: (p: { issues: unknown[] }) => p.issues.length === 0 }

/**
 * Texto decimal con punto, sin signo, sin exponente y con las cifras de una columna
 * `NUMERIC` (docs/PLANOS-DE-CONSTRUCCION.md §4). Los importes viajan como texto, nunca
 * como `number` (ADR-04); la coma decimal se resuelve antes, con `parsear` de `numero.ts`.
 */
export function decimalTexto({ enteros, decimales }: Precision) {
  const patron = new RegExp(`^\\d{1,${enteros}}(\\.\\d{1,${decimales}})?$`)
  return z
    .string({ error: 'Debe ser un número escrito como texto.' })
    .regex(patron, {
      error: `Número inválido: hasta ${enteros} cifras enteras y ${decimales} decimales, con punto.`,
    })
}

/** Cantidades: `NUMERIC(12,3)`. */
export const cantidadSchema = decimalTexto({ enteros: 9, decimales: 3 })

/** Costos unitarios: `NUMERIC(14,4)`. */
export const costoUnitarioSchema = decimalTexto({ enteros: 10, decimales: 4 })

/** Importes y precios: `NUMERIC(14,2)`. */
export const importeSchema = decimalTexto({ enteros: 12, decimales: 2 })

/** Un importe que no puede ser cero: un precio que se fija a mano. */
export const importePositivoSchema = importeSchema.refine((i) => esMayor(i, '0'), {
  error: 'El importe debe ser mayor que cero.',
  ...soloSiNoHayErrores,
})

/** Un importe con signo (un ajuste que sube o baja un precio): `NUMERIC(14,2)` con `-` opcional. */
export const importeConSignoSchema = z
  .string({ error: 'Debe ser un número escrito como texto.' })
  .regex(/^-?\d{1,12}(\.\d{1,2})?$/, {
    error: 'Número inválido: hasta 12 cifras enteras y 2 decimales, con punto y signo opcional.',
  })

/** Porcentajes: `NUMERIC(7,3)`. */
export const porcentajeSchema = decimalTexto({ enteros: 4, decimales: 3 })

/** Medidas en centímetros: `NUMERIC(7,2)`. Puede ser cero (un sangrado o una calle nulos). */
export const medidaSchema = decimalTexto({ enteros: 5, decimales: 2 })

/** Una cantidad que no puede ser cero: la del trabajo, o la que se pide cotizar. */
export const cantidadPositivaSchema = cantidadSchema.refine((c) => esMayor(c, '0'), {
  error: 'La cantidad debe ser mayor que cero.',
  ...soloSiNoHayErrores,
})

/** Medida de una pieza o un pliego: no puede ser cero. */
export const medidaPositivaSchema = medidaSchema.refine((m) => esMayor(m, '0'), {
  error: 'Debe ser mayor que cero.',
  ...soloSiNoHayErrores,
})

/** Hojas enteras (el arranque de una etapa): sin decimales. */
export const hojasSchema = z
  .string({ error: 'Debe ser un número escrito como texto.' })
  .regex(/^\d{1,6}$/, { error: 'Debe ser un número entero de hojas, sin decimales.' })
