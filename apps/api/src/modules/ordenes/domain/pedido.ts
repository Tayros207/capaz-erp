import { MAXIMO_DE_LINEAS_DE_PEDIDO, calcularTotalesDePedido, fichaNormalizada, type FichaDeMaquina, type LineaDeEntrada } from '@capaz/shared';

// Reglas puras del pedido: código visible, fechas, líneas y totales. Sin base ni framework.

/** Clave del correlativo (`core.contadores`); la serie es el código de la sucursal. */
export const CLAVE_DE_CORRELATIVO = 'ordenes.pedido';

/** `PED-PRI-2026-0007`. Sin número todavía (borrador) muestra «Borrador». */
export function codigoDePedido(serie: string | null, anio: number | null, numero: number | null): string {
  if (serie === null || anio === null || numero === null) return 'Borrador';
  return `PED-${serie}-${anio}-${String(numero).padStart(4, '0')}`;
}

export type Comprobacion = { ok: true } | { ok: false; motivo: string };

/** La entrega no puede ser anterior a la fecha del pedido (días `AAAA-MM-DD`). */
export function comprobarFechas(fecha: string, entregaEl: string | null): Comprobacion {
  return entregaEl !== null && entregaEl < fecha ? { ok: false, motivo: 'La entrega no puede ser anterior a la fecha del pedido.' } : { ok: true };
}

export type CambioDeDato = { campo: 'entregaEl' | 'responsableId' | 'notas'; antes: string | null; despues: string | null };

/**
 * Lo que de verdad cambia al corregir los datos de un pedido: solo los campos que llegan y que difieren de lo guardado.
 * Vacío o `null` quita el valor. Devuelve el antes y el después de cada uno (la huella).
 */
export function cambiosDeDatos(
  actual: { entregaEl: string | null; responsableId: string | null; notas: string | null },
  nuevos: { entregaEl?: string | null; responsableId?: string | null; notas?: string | null },
): CambioDeDato[] {
  const salida: CambioDeDato[] = [];
  for (const campo of ['entregaEl', 'responsableId', 'notas'] as const) {
    const llega = nuevos[campo];
    if (llega === undefined) continue;
    const despues = llega?.trim() || null;
    if (despues !== actual[campo]) salida.push({ campo, antes: actual[campo], despues });
  }
  return salida;
}

/** Para confirmar: entre 1 y 100 líneas. */
export function comprobarLineasParaConfirmar(cantidad: number): Comprobacion {
  if (cantidad < 1) return { ok: false, motivo: 'Agrega al menos una línea antes de confirmar el pedido.' };
  if (cantidad > MAXIMO_DE_LINEAS_DE_PEDIDO) return { ok: false, motivo: `Un pedido admite hasta ${MAXIMO_DE_LINEAS_DE_PEDIDO} líneas.` };
  return { ok: true };
}

/** Lo que una línea toma del producto cuando no llega. */
export type ProductoParaLinea = { id: string; nombre: string; unidad: string; precioUnitarioMilesimas: number; afectoIgv: boolean; archivado: boolean };

export type LineaPreparada = {
  posicion: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  precioUnitarioMilesimas: number;
  afectoIgv: boolean;
  importeCentimos: number;
} & FichaDeMaquina;

export type LineasPreparadas =
  | { ok: true; lineas: LineaPreparada[]; subtotalCentimos: number; igvCentimos: number; totalCentimos: number }
  | { ok: false; motivo: string };

const UNIDAD_POR_DEFECTO = 'unidad';

/**
 * Completa cada línea con su producto (descripción, unidad, precio y afectación que no lleguen), le
 * pone posición e importe, y calcula los totales del pedido. `productos` trae los que las líneas citan.
 */
export function prepararLineas(entradas: readonly LineaDeEntrada[], productos: ReadonlyMap<string, ProductoParaLinea>, igvPorcentaje: number): LineasPreparadas {
  const completas: Omit<LineaPreparada, 'importeCentimos'>[] = [];
  for (const [i, e] of entradas.entries()) {
    const n = i + 1;
    const producto = e.productoId ? productos.get(e.productoId) : undefined;
    if (e.productoId && (!producto || producto.archivado)) return { ok: false, motivo: `Línea ${n}: el producto no existe o está archivado.` };
    const descripcion = e.descripcion || producto?.nombre;
    const precio = e.precioUnitarioMilesimas ?? producto?.precioUnitarioMilesimas;
    if (!descripcion || precio === undefined) return { ok: false, motivo: `Línea ${n}: una línea sin producto necesita descripción y precio.` };
    completas.push({
      posicion: i,
      productoId: producto?.id ?? null,
      descripcion,
      unidad: e.unidad || producto?.unidad || UNIDAD_POR_DEFECTO,
      cantidadMilesimas: e.cantidadMilesimas,
      precioUnitarioMilesimas: precio,
      afectoIgv: e.afectoIgv ?? producto?.afectoIgv ?? true,
      ...fichaNormalizada(e),
    });
  }
  try {
    const t = calcularTotalesDePedido(completas, igvPorcentaje);
    return {
      ok: true,
      lineas: completas.map((l, i) => ({ ...l, importeCentimos: t.lineas[i]!.importeCentimos })),
      subtotalCentimos: t.subtotalCentimos,
      igvCentimos: t.igvCentimos,
      totalCentimos: t.totalCentimos,
    };
  } catch {
    // `importe` y la suma se niegan a devolver un entero que no sea seguro.
    return { ok: false, motivo: 'El importe del pedido es demasiado grande.' };
  }
}
