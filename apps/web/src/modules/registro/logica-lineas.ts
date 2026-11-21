import { MAXIMO_DE_LINEAS_DE_MOVIMIENTO, type LineaDeMovimientoDto, type LineaDeMovimientoEntrada } from '@capaz/shared';
import { resolverPrecioEImporte } from '../../shared/formato/precio-total.ts';

// Lógica pura de los productos de un movimiento: cada fila lleva cantidad y precio unitario o subtotal (lo último escrito manda),
// igual que las líneas de un pedido. Con productos, el monto del movimiento es la suma de los subtotales.

export { MAXIMO_DE_LINEAS_DE_MOVIMIENTO };

export type FilaDeProducto = {
  clave: string;
  /** `false` mientras la persona todavía no eligió producto ni escribió uno libre. */
  elegida: boolean;
  /** Producto del catálogo; `null` = texto libre. */
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number | null;
  precioUnitarioMilesimas: number | null;
  manda: 'precio' | 'importe';
  importeEscritoCentimos: number | null;
};

export type ProductoElegido = { id: string; nombre: string; unidad: string; precioUnitarioMilesimas: number };

export const filaDeProductoVacia = (clave: string): FilaDeProducto => ({
  clave, elegida: false, productoId: null, descripcion: '', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: null, manda: 'precio', importeEscritoCentimos: null,
});

/** Una fila con el producto del catálogo: trae su nombre, su unidad y su precio de referencia. */
export const filaDeCatalogo = (clave: string, p: ProductoElegido): FilaDeProducto => ({
  ...filaDeProductoVacia(clave), elegida: true, productoId: p.id, descripcion: p.nombre, unidad: p.unidad, precioUnitarioMilesimas: p.precioUnitarioMilesimas,
});

/** Una fila de texto libre (el producto no está en el catálogo). */
export const filaLibre = (clave: string, texto: string): FilaDeProducto => ({ ...filaDeProductoVacia(clave), elegida: true, descripcion: texto.trim() });

export const filaDeLineaGuardada = (l: LineaDeMovimientoDto, clave: string): FilaDeProducto => ({
  clave, elegida: true, productoId: l.productoId, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas, precioUnitarioMilesimas: l.precioUnitarioMilesimas, manda: 'precio', importeEscritoCentimos: null,
});

export const filasDeLineasGuardadas = (lineas: readonly LineaDeMovimientoDto[]): FilaDeProducto[] => lineas.map((l, i) => filaDeLineaGuardada(l, `g${i}`));

const calculada = (f: FilaDeProducto) => resolverPrecioEImporte(f.cantidadMilesimas, f.precioUnitarioMilesimas, f.importeEscritoCentimos, f.manda);

/** Cantidad × unitario con la cuenta del servidor; nulo si falta un dato. */
export const subtotalDeFila = (f: FilaDeProducto): number | null => calculada(f).importeCentimos;
/** `false` cuando el unitario (tres decimales) no reproduce el subtotal escrito al céntimo. */
export const cuadraFila = (f: FilaDeProducto): boolean => calculada(f).exacto;

/** La suma de los subtotales; nulo si alguna fila está incompleta (no hay total fiable). */
export function totalDeFilas(filas: readonly FilaDeProducto[]): number | null {
  let total = 0;
  for (const f of filas) {
    const s = subtotalDeFila(f);
    if (s === null) return null;
    total += s;
  }
  return total;
}

/** Si manda el subtotal, al cambiar la cantidad el unitario se recalcula para que el subtotal siga siendo el escrito. */
export function filaConCantidad(f: FilaDeProducto, cantidadMilesimas: number | null): FilaDeProducto {
  const nueva = { ...f, cantidadMilesimas };
  return f.manda === 'importe' ? { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas } : nueva;
}

/** Escribir el unitario devuelve el mando al precio. */
export const filaConPrecio = (f: FilaDeProducto, precioUnitarioMilesimas: number | null): FilaDeProducto => ({ ...f, precioUnitarioMilesimas, manda: 'precio', importeEscritoCentimos: null });

/** Escribir el subtotal manda: el unitario sale de repartirlo entre la cantidad. */
export function filaConSubtotal(f: FilaDeProducto, centimos: number | null): FilaDeProducto {
  const nueva: FilaDeProducto = { ...f, manda: 'importe', importeEscritoCentimos: centimos };
  return { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas };
}

export type ErroresDeProducto = Partial<Record<'descripcion' | 'cantidad' | 'precio', string>>;

export function erroresDeProducto(f: FilaDeProducto): ErroresDeProducto {
  const e: ErroresDeProducto = {};
  if (!f.elegida) {
    e.descripcion = 'Elige el producto o usa «Solo el importe».';
    return e;
  }
  if (f.descripcion.trim() === '') e.descripcion = 'Escribe qué producto es.';
  if (f.cantidadMilesimas === null || f.cantidadMilesimas < 1) e.cantidad = 'La cantidad debe ser mayor que cero.';
  if (f.precioUnitarioMilesimas === null) e.precio = 'Falta el precio.';
  return e;
}

/** Por qué todavía no se pueden guardar los productos; nulo si están completos y suman más de cero. */
export function motivoDeProductosIncompletos(filas: readonly FilaDeProducto[]): string | null {
  if (filas.length > MAXIMO_DE_LINEAS_DE_MOVIMIENTO) return `Un movimiento admite hasta ${MAXIMO_DE_LINEAS_DE_MOVIMIENTO} productos.`;
  for (const [i, f] of filas.entries()) {
    const error = Object.values(erroresDeProducto(f))[0];
    if (error) return f.elegida ? `Producto ${i + 1}: ${error}` : error;
  }
  const total = totalDeFilas(filas);
  if (filas.length > 0 && (total === null || total <= 0)) return 'La suma de los productos debe ser mayor que cero.';
  return null;
}

/** Lo que viaja al servidor (el subtotal lo calcula él). */
export const lineasDeFilas = (filas: readonly FilaDeProducto[]): LineaDeMovimientoEntrada[] =>
  filas.map((f) => ({
    ...(f.productoId ? { productoId: f.productoId } : {}),
    descripcion: f.descripcion.trim(),
    unidad: f.unidad.trim() || 'unidad',
    cantidadMilesimas: f.cantidadMilesimas ?? 0,
    precioUnitarioMilesimas: f.precioUnitarioMilesimas ?? 0,
  }));

const normalizada = (l: { productoId?: string | null | undefined; descripcion: string; unidad?: string | undefined; cantidadMilesimas: number; precioUnitarioMilesimas: number }) =>
  [l.productoId ?? null, l.descripcion.trim(), (l.unidad ?? 'unidad').trim() || 'unidad', l.cantidadMilesimas, l.precioUnitarioMilesimas].join('|');

/** ¿Las filas dicen lo mismo que las líneas guardadas? (Para mandar solo lo que cambia.) */
export const mismasQueLasGuardadas = (filas: readonly FilaDeProducto[], guardadas: readonly LineaDeMovimientoDto[]): boolean =>
  filas.length === guardadas.length && lineasDeFilas(filas).every((l, i) => normalizada(l) === normalizada(guardadas[i]!));

/** Una clave nueva para la siguiente fila (estable entre renders). */
export const claveSiguiente = (filas: readonly FilaDeProducto[]): string => `n${filas.reduce((mayor, f) => Math.max(mayor, Number(f.clave.replace(/\D/g, '')) || 0), 0) + 1}`;
