import type { CostoPorArticuloDto, EntradaDe } from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura del comparador de costos: filtros, variación del último costo frente a la mediana y orden.
// Los costos van en milésimas de sol por unidad, con IGV.

export type FiltrosDeCostos = { buscar: string; desde: string; hasta: string };
export const SIN_FILTROS_DE_COSTOS: FiltrosDeCostos = { buscar: '', desde: '', hasta: '' };

const MS_POR_DIA = 86_400_000;
const MAX_DIAS_DE_PERIODO = 730; // «como máximo 2 años», igual que el servidor

const aMs = (dia: string): number => Date.parse(`${dia}T00:00:00Z`);

/** Texto de error del período, o nada si vale (vacío = lo que el servidor asume: el último año). */
export function errorDePeriodo(f: Pick<FiltrosDeCostos, 'desde' | 'hasta'>): string | undefined {
  if (f.desde && f.hasta) {
    if (f.desde > f.hasta) return 'El período empieza antes de terminar.';
    if ((aMs(f.hasta) - aMs(f.desde)) / MS_POR_DIA > MAX_DIAS_DE_PERIODO) return 'El período abarca como máximo 2 años.';
  }
  return undefined;
}

export const hayFiltrosDeCostos = (f: FiltrosDeCostos): boolean => f.buscar.trim() !== '' || f.desde !== '' || f.hasta !== '';

export function argumentosDeCostos(f: FiltrosDeCostos): EntradaDe<'compras_costos_por_articulo'> {
  const buscar = f.buscar.trim();
  return { ...(buscar && { buscar }), ...(f.desde && { desde: f.desde }), ...(f.hasta && { hasta: f.hasta }) };
}

export type VariacionDeCosto = { texto: string; tono: TonoDeInsignia };

/** «Subió 12 %» / «Bajó 5 %» / «Sin cambio»: el texto va siempre además del color. Subir es malo para quien compra. */
export function variacionDeCosto(porcentaje: number | null): VariacionDeCosto {
  if (porcentaje === null) return { texto: 'Sin referencia', tono: 'neutro' };
  if (porcentaje === 0) return { texto: 'Sin cambio', tono: 'neutro' };
  if (porcentaje > 0) return { texto: `Subió ${porcentaje} %`, tono: porcentaje >= 10 ? 'peligro' : 'aviso' };
  return { texto: `Bajó ${Math.abs(porcentaje)} %`, tono: 'exito' };
}

/** Nombre del proveedor más barato, o nada si no hay con quién comparar. */
export function proveedorMasBarato(a: Pick<CostoPorArticuloDto, 'masBaratoProveedorId' | 'porProveedor'>): string | null {
  if (!a.masBaratoProveedorId) return null;
  return a.porProveedor.find((p) => p.proveedorId === a.masBaratoProveedorId)?.proveedorNombre ?? null;
}

export const textoDeCompras = (n: number): string => (n === 1 ? '1 compra' : `${n} compras`);

/** Primero lo que más subió, para verlo de un vistazo; los demás por nombre. */
export function ordenarPorVariacion(articulos: readonly CostoPorArticuloDto[]): CostoPorArticuloDto[] {
  return [...articulos].sort((a, b) => (b.variacionPorcentaje ?? -Infinity) - (a.variacionPorcentaje ?? -Infinity) || a.descripcion.localeCompare(b.descripcion, 'es'));
}
