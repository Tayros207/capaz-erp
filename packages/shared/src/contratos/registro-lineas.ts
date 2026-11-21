import { z } from 'zod';
import { importe } from '../dinero.js';

// Productos de un movimiento de Registro (0038): cantidad y precio de lo que se vendió o compró. Con líneas, el monto del
// movimiento es la suma de los subtotales (cantidad × precio unitario, con la cuenta de `importe`).

export const MAXIMO_DE_LINEAS_DE_MOVIMIENTO = 50;

/** Una línea tal como se escribe: lo que se calcula (subtotal) no viaja. */
export const lineaDeMovimientoEntradaSchema = z.strictObject({
  /** Producto del catálogo; sin él, la línea es texto libre. */
  productoId: z.uuid().nullish(),
  descripcion: z.string().trim().min(1, { error: 'Escribe qué producto es.' }).max(300),
  unidad: z.string().trim().min(1, { error: 'Indica la unidad.' }).max(20).default('unidad'),
  cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  precioUnitarioMilesimas: z.number().int().safe().min(0, { error: 'El precio no puede ser negativo.' }),
});
export type LineaDeMovimientoEntrada = z.infer<typeof lineaDeMovimientoEntradaSchema>;

export const lineasDeMovimientoEntradaSchema = z
  .array(lineaDeMovimientoEntradaSchema)
  .max(MAXIMO_DE_LINEAS_DE_MOVIMIENTO, { error: `Un movimiento admite hasta ${MAXIMO_DE_LINEAS_DE_MOVIMIENTO} productos.` });

/** Una línea guardada. */
export const lineaDeMovimientoSchema = z.strictObject({
  id: z.string(),
  orden: z.number().int(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
  subtotalCentimos: z.number().int(),
});
export type LineaDeMovimientoDto = z.infer<typeof lineaDeMovimientoSchema>;

export type LineaCalculada = {
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  subtotalCentimos: number;
};

/** Las líneas con su subtotal y la suma de todas. Misma cuenta del servidor y de la web. */
export function calcularLineasDeMovimiento(entradas: readonly LineaDeMovimientoEntrada[]): { lineas: LineaCalculada[]; totalCentimos: number } {
  const lineas = entradas.map((l) => ({
    productoId: l.productoId ?? null,
    descripcion: l.descripcion.trim(),
    unidad: (l.unidad ?? 'unidad').trim() || 'unidad',
    cantidadMilesimas: l.cantidadMilesimas,
    precioUnitarioMilesimas: l.precioUnitarioMilesimas,
    subtotalCentimos: importe(l.cantidadMilesimas, l.precioUnitarioMilesimas),
  }));
  return { lineas, totalCentimos: lineas.reduce((suma, l) => suma + l.subtotalCentimos, 0) };
}
