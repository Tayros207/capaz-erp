import { MAXIMO_DE_LINEAS_DE_PEDIDO, type Centimos } from '@capaz/shared';
import { formatearCantidad, milesimasATexto } from '../../shared/formato/milesimas.ts';
import { resolverPrecioEImporte } from '../../shared/formato/precio-total.ts';
import { formatearSoles } from '../../shared/formato/soles.ts';

// Lógica pura del editor de líneas de un pedido: la cantidad y el precio unitario o el subtotal (lo último escrito manda).

export { MAXIMO_DE_LINEAS_DE_PEDIDO };

export type FilaDeLinea = {
  clave: string;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number | null;
  precioUnitarioMilesimas: number | null;
  manda: 'precio' | 'importe';
  importeEscritoCentimos: number | null;
  /** Todo lo que no se edita aquí (`productoId`, `afectoIgv`…): vuelve intacto. */
  resto: Record<string, unknown>;
};

const CLAVES_EDITADAS = ['descripcion', 'unidad', 'cantidadMilesimas', 'precioUnitarioMilesimas'];

const esObjeto = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const numeroONulo = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Un arreglo de objetos planos cuyo `cantidadMilesimas`, si existe, es un número. */
export function esListaDeLineas(v: unknown): v is Record<string, unknown>[] {
  return Array.isArray(v) && v.every((l) => esObjeto(l) && (l.cantidadMilesimas === undefined || typeof l.cantidadMilesimas === 'number'));
}

export function filaDeLinea(l: Record<string, unknown>, clave: string): FilaDeLinea {
  return {
    clave,
    descripcion: typeof l.descripcion === 'string' ? l.descripcion : '',
    unidad: typeof l.unidad === 'string' ? l.unidad : '',
    cantidadMilesimas: numeroONulo(l.cantidadMilesimas),
    precioUnitarioMilesimas: numeroONulo(l.precioUnitarioMilesimas),
    manda: 'precio',
    importeEscritoCentimos: null,
    resto: Object.fromEntries(Object.entries(l).filter(([k]) => !CLAVES_EDITADAS.includes(k))),
  };
}

export const filasDeLineas = (v: unknown): FilaDeLinea[] => (esListaDeLineas(v) ? v.map((l, i) => filaDeLinea(l, `l${i}`)) : []);

export const filaVacia = (clave: string): FilaDeLinea => ({
  clave,
  descripcion: '',
  unidad: 'unidad',
  cantidadMilesimas: 1000,
  precioUnitarioMilesimas: null,
  manda: 'precio',
  importeEscritoCentimos: null,
  resto: {},
});

export function lineaDeFila(f: FilaDeLinea): Record<string, unknown> {
  return {
    descripcion: f.descripcion.trim(),
    ...(f.unidad.trim() !== '' ? { unidad: f.unidad } : {}),
    ...(f.cantidadMilesimas !== null ? { cantidadMilesimas: f.cantidadMilesimas } : {}),
    ...(f.precioUnitarioMilesimas !== null ? { precioUnitarioMilesimas: f.precioUnitarioMilesimas } : {}),
    ...f.resto,
  };
}

export const lineasDeFilas = (filas: readonly FilaDeLinea[]): Record<string, unknown>[] => filas.map(lineaDeFila);

const calculada = (f: FilaDeLinea) => resolverPrecioEImporte(f.cantidadMilesimas, f.precioUnitarioMilesimas, f.importeEscritoCentimos, f.manda);

/** Lo que da cantidad × unitario con la cuenta del servidor; nulo si falta un dato. */
export const subtotalDeFila = (f: FilaDeLinea): number | null => calculada(f).importeCentimos;

/** `false` cuando el unitario (tres decimales) no reproduce el subtotal escrito al céntimo. */
export const cuadraFila = (f: FilaDeLinea): boolean => calculada(f).exacto;

export function totalDeFilas(filas: readonly FilaDeLinea[]): number | null {
  let total = 0;
  for (const f of filas) {
    const s = subtotalDeFila(f);
    if (s === null) return null;
    total += s;
  }
  return total;
}

/** Si manda el subtotal, al cambiar la cantidad el unitario se recalcula para que el subtotal siga siendo el escrito. */
export function filaConCantidad(f: FilaDeLinea, cantidadMilesimas: number | null): FilaDeLinea {
  const nueva = { ...f, cantidadMilesimas };
  if (f.manda !== 'importe') return nueva;
  return { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas };
}

/** Escribir el unitario devuelve el mando al precio. */
export const filaConPrecio = (f: FilaDeLinea, precioUnitarioMilesimas: number | null): FilaDeLinea => ({ ...f, precioUnitarioMilesimas, manda: 'precio', importeEscritoCentimos: null });

/** Escribir el subtotal manda: el unitario sale de repartirlo entre la cantidad. */
export function filaConSubtotal(f: FilaDeLinea, centimos: number | null): FilaDeLinea {
  const nueva: FilaDeLinea = { ...f, manda: 'importe', importeEscritoCentimos: centimos };
  return { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas };
}

export type ErroresDeFila = Partial<Record<'descripcion' | 'cantidad' | 'precio', string>>;

export function erroresDeFila(f: FilaDeLinea): ErroresDeFila {
  const e: ErroresDeFila = {};
  if (f.descripcion.trim() === '') e.descripcion = 'Escribe qué se pide.';
  if (f.cantidadMilesimas === null || f.cantidadMilesimas < 1) e.cantidad = 'La cantidad debe ser mayor que cero.';
  if (f.precioUnitarioMilesimas === null) e.precio = 'Falta el precio.';
  return e;
}

/** Por qué todavía no se puede aprobar un `pedido_crear`; nulo si está completo. */
export function motivoDePedidoIncompleto(args: Record<string, unknown>): string | null {
  if (typeof args.clienteId !== 'string' || args.clienteId === '') return 'Elige el cliente.';
  const lineas = Array.isArray(args.lineas) ? args.lineas : [];
  if (lineas.length === 0) return 'Agrega al menos una línea.';
  for (const [i, l] of lineas.entries()) {
    const error = Object.values(erroresDeFila(filaDeLinea(esObjeto(l) ? l : {}, `l${i}`)))[0];
    if (error) return `Línea ${i + 1}: ${error}`;
  }
  return null;
}

/** Una línea en una frase: «tarjetas — 500 unidad × S/ 0.365 = S/ 182.50». */
export function textoDeLinea(l: Record<string, unknown>): string {
  const f = filaDeLinea(l, 'x');
  const cantidad = f.cantidadMilesimas === null ? '' : formatearCantidad(f.cantidadMilesimas, f.unidad);
  const sub = subtotalDeFila(f);
  if (f.precioUnitarioMilesimas === null || sub === null) return `${f.descripcion} — ${cantidad} — sin precio`;
  return `${f.descripcion} — ${cantidad} × S/ ${milesimasATexto(f.precioUnitarioMilesimas)} = ${formatearSoles(sub as Centimos)}`;
}
