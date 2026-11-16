import { MAXIMO_DE_LINEAS_DE_COMPRA, calcularTotalesDeCompra, type LineaDeCompraEntrada } from '@capaz/shared';

// Reglas puras de la orden de compra: código visible, fechas, líneas y totales. Sin base ni framework.

/** Clave del correlativo (`core.contadores`); la serie es el código de la sucursal. */
export const CLAVE_DE_CORRELATIVO = 'compras.orden';

/** `OC-PRI-2026-0001`. Sin número todavía (borrador) muestra «Borrador». */
export function codigoDeOrden(serie: string | null, anio: number | null, numero: number | null): string {
  if (serie === null || anio === null || numero === null) return 'Borrador';
  return `OC-${serie}-${anio}-${String(numero).padStart(4, '0')}`;
}

export type Comprobacion = { ok: true } | { ok: false; motivo: string };

/** La entrega no puede ser anterior a la fecha de la orden (días `AAAA-MM-DD`). */
export function comprobarFechas(fecha: string, entregaEl: string | null): Comprobacion {
  return entregaEl !== null && entregaEl < fecha ? { ok: false, motivo: 'La entrega no puede ser anterior a la fecha de la orden.' } : { ok: true };
}

/** Para enviar: entre 1 y 100 líneas. */
export function comprobarLineasParaEnviar(cantidad: number): Comprobacion {
  if (cantidad < 1) return { ok: false, motivo: 'Agrega al menos una línea antes de enviar la orden.' };
  if (cantidad > MAXIMO_DE_LINEAS_DE_COMPRA) return { ok: false, motivo: `Una orden de compra admite hasta ${MAXIMO_DE_LINEAS_DE_COMPRA} líneas.` };
  return { ok: true };
}

/** Lo que una línea toma del producto cuando no llega. El costo nunca sale del producto: su precio es de venta. */
export type ProductoParaLinea = { id: string; nombre: string; unidad: string; afectoIgv: boolean; archivado: boolean };

export type LineaPreparada = {
  posicion: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  costoUnitarioMilesimas: number;
  afectoIgv: boolean;
  importeCentimos: number;
};

export type LineasPreparadas =
  | { ok: true; lineas: LineaPreparada[]; subtotalCentimos: number; igvCentimos: number; totalCentimos: number }
  | { ok: false; motivo: string };

const UNIDAD_POR_DEFECTO = 'unidad';

/**
 * Completa cada línea con su producto (descripción, unidad y afectación que no lleguen), le pone
 * posición e importe y calcula los totales de la orden. El costo unitario siempre llega (incluye IGV).
 * Una línea sin producto es un gasto: necesita descripción. `productos` trae los que las líneas citan.
 */
export function prepararLineas(entradas: readonly LineaDeCompraEntrada[], productos: ReadonlyMap<string, ProductoParaLinea>, igvPorcentaje: number): LineasPreparadas {
  const completas: Omit<LineaPreparada, 'importeCentimos'>[] = [];
  for (const [i, e] of entradas.entries()) {
    const n = i + 1;
    const producto = e.productoId ? productos.get(e.productoId) : undefined;
    if (e.productoId && (!producto || producto.archivado)) return { ok: false, motivo: `Línea ${n}: el producto no existe o está archivado.` };
    const descripcion = e.descripcion || producto?.nombre;
    if (!descripcion) return { ok: false, motivo: `Línea ${n}: una línea sin producto necesita descripción.` };
    completas.push({
      posicion: i,
      productoId: producto?.id ?? null,
      descripcion,
      unidad: e.unidad || producto?.unidad || UNIDAD_POR_DEFECTO,
      cantidadMilesimas: e.cantidadMilesimas,
      costoUnitarioMilesimas: e.costoUnitarioMilesimas,
      afectoIgv: e.afectoIgv ?? producto?.afectoIgv ?? true,
    });
  }
  try {
    const t = calcularTotalesDeCompra(completas, igvPorcentaje);
    return {
      ok: true,
      lineas: completas.map((l, i) => ({ ...l, importeCentimos: t.lineas[i]!.importeCentimos })),
      subtotalCentimos: t.subtotalCentimos,
      igvCentimos: t.igvCentimos,
      totalCentimos: t.totalCentimos,
    };
  } catch {
    // `importe` y la suma se niegan a devolver un entero que no sea seguro.
    return { ok: false, motivo: 'El importe de la orden es demasiado grande.' };
  }
}
