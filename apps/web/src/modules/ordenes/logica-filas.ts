import { resolverPrecioEImporte } from '../../shared/formato/precio-total.ts';
import { conProducto, estaEnBlanco, lineaVacia, sinFilasEnBlanco, type LineaDeFormulario } from './logica.ts';

// Lógica pura de las filas en línea de la hoja del pedido: lo último que se escribe (precio o importe) manda.

export { estaEnBlanco, sinFilasEnBlanco };

export const MAXIMO_DE_FILAS = 100;

const calculada = (l: LineaDeFormulario) => resolverPrecioEImporte(l.cantidadMilesimas, l.precioUnitarioMilesimas, l.importeEscritoCentimos, l.manda);

/** Si manda el importe, al cambiar la cantidad el unitario se recalcula para que el importe siga siendo el escrito. */
export function cambiarCantidad(l: LineaDeFormulario, cantidadMilesimas: number | null): LineaDeFormulario {
  const nueva = { ...l, cantidadMilesimas };
  if (l.manda !== 'importe') return nueva;
  return { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas };
}

/** Escribir el unitario devuelve el mando al precio. */
export const cambiarPrecio = (l: LineaDeFormulario, precioUnitarioMilesimas: number | null): LineaDeFormulario => ({ ...l, precioUnitarioMilesimas, manda: 'precio', importeEscritoCentimos: null });

/** Escribir el importe manda: el unitario sale de repartirlo entre la cantidad. */
export function cambiarImporte(l: LineaDeFormulario, importeCentimos: number | null): LineaDeFormulario {
  const nueva: LineaDeFormulario = { ...l, manda: 'importe', importeEscritoCentimos: importeCentimos };
  return { ...nueva, precioUnitarioMilesimas: calculada(nueva).precioUnitarioMilesimas };
}

/** El importe que muestra la fila: el que dan cantidad y unitario (el del servidor). */
export const importeMostrado = (l: LineaDeFormulario): number | null => calculada(l).importeCentimos;

/** `false` cuando el unitario (tres decimales) no reproduce el importe escrito al céntimo. */
export const cuadra = (l: LineaDeFormulario): boolean => calculada(l).exacto;

/** Enter en el importe de la última fila agrega otra; en las demás no hace nada. `foco` es la fila que recibe el cursor. */
export function alEnterEnImporte(lineas: readonly LineaDeFormulario[], clave: string, claveNueva: string): { lineas: LineaDeFormulario[]; foco: string | null } {
  if (lineas.length >= MAXIMO_DE_FILAS || lineas[lineas.length - 1]?.clave !== clave) return { lineas: [...lineas], foco: null };
  return { lineas: [...lineas, lineaVacia(claveNueva)], foco: claveNueva };
}

/** Quita una fila; siempre queda al menos una. */
export const quitarFila = (lineas: readonly LineaDeFormulario[], clave: string): LineaDeFormulario[] => (lineas.length <= 1 ? [...lineas] : lineas.filter((l) => l.clave !== clave));

type ProductoDeCatalogo = Parameters<typeof conProducto>[1] & object;

/** Un producto del catálogo llena la última fila en blanco o, si no hay, agrega una fila con él. */
export function agregarDesdeCatalogo(lineas: readonly LineaDeFormulario[], producto: ProductoDeCatalogo, claveNueva: string): LineaDeFormulario[] {
  const ultima = lineas[lineas.length - 1];
  if (ultima && estaEnBlanco(ultima)) return [...lineas.slice(0, -1), { ...conProducto(ultima, producto), cantidadMilesimas: ultima.cantidadMilesimas ?? 1000 }];
  if (lineas.length >= MAXIMO_DE_FILAS) return [...lineas];
  return [...lineas, conProducto(lineaVacia(claveNueva), producto)];
}
