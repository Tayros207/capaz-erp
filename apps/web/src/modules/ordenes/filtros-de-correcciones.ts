import type { CorreccionConAjusteDto, EntradaDe } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';

// Lógica pura de la pantalla «Correcciones»: filtros y la lectura del ajuste de deuda de cada fila.

export type FiltrosDeCorrecciones = { desde: string; hasta: string; autorId: string; pedidoId: string };
export const SIN_FILTROS: FiltrosDeCorrecciones = { desde: '', hasta: '', autorId: '', pedidoId: '' };

/** Solo lo que tiene valor; así el servidor no recibe filtros vacíos. */
export function argumentosDeFiltros(f: FiltrosDeCorrecciones): Omit<EntradaDe<'correcciones_listar'>, 'cursor'> {
  return { ...(f.desde && { desde: f.desde }), ...(f.hasta && { hasta: f.hasta }), ...(f.autorId && { autorId: f.autorId }), ...(f.pedidoId && { pedidoId: f.pedidoId }) };
}

export const errorDeFiltros = (f: FiltrosDeCorrecciones): string | null => (f.desde && f.hasta && f.desde > f.hasta ? 'El período empieza antes de terminar: revisa «Desde» y «Hasta».' : null);

export const hayFiltros = (f: FiltrosDeCorrecciones): boolean => Object.values(f).some(Boolean);

/** El efecto en la deuda: «Deuda DEU-1: +S/ 20.00 · a favor del cliente S/ 5.00», o «Sin ajuste de deuda». */
export function textoDeAjuste(a: CorreccionConAjusteDto['ajuste']): string {
  if (!a) return 'Sin ajuste de deuda';
  const monto = `${a.montoCentimos >= 0 ? '+' : '−'}${formatearSoles(Math.abs(a.montoCentimos))}`;
  return `Deuda ${a.deudaCodigo}: ${monto}${a.aFavorCentimos > 0 ? ` · a favor del cliente ${formatearSoles(a.aFavorCentimos)}` : ''}`;
}
