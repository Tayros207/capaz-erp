import type { Centimos, EntradaDe } from '@capaz/shared';
import { limpiarEntrada } from '../logica-taller.ts';
import { columnasQueSeEnvian, type Columna, type FilaDirecta, type Vista } from './logica-cuadro.ts';

// Cuadro directo, utilidad, precio final y guardado de referencias: armado de argumentos. Sin cuentas: el servidor calcula.

const PORCENTAJE = /^\d{1,4}(\.\d{1,3})?$/;

export const porcentajeDeUtilidadValido = (t: string): string | undefined => (PORCENTAJE.test(limpiarEntrada(t)) ? undefined : 'Escribe un porcentaje con hasta 3 decimales.');

/** Una celda del cuadro directo: `null` la vacía (el servidor la vuelve a deducir o a pedir). */
export const argumentosDeCelda = (id: string, fila: FilaDirecta, columna: Columna, importeCentimos: number | null): EntradaDe<'cuadro_fijar_costo_directo'> => ({
  id, celdas: [{ fila: fila.clave, columna, importeCentimos }],
});
export const argumentosDeFija = (id: string, fila: FilaDirecta, fija: boolean): EntradaDe<'cuadro_fijar_costo_directo'> => ({ id, fijas: [{ fila: fila.clave, fija }] });

/** Marca o desmarca una cantidad para enviar al cliente; siempre queda al menos una (el servidor también lo exige). */
export function columnasAlAlternar(v: Vista, columna: Columna, marcada: boolean): Columna[] | null {
  const actuales = columnasQueSeEnvian(v);
  const nuevas = marcada ? [...new Set([...actuales, columna])] : actuales.filter((c) => c !== columna);
  return nuevas.length === 0 ? null : (['100', '1000', '5000'] as const).filter((c) => nuevas.includes(c));
}
export const argumentosDeColumnas = (id: string, columnas: Columna[]): EntradaDe<'cuadro_fijar_columnas_a_enviar'> => ({ id, columnas });

export function argumentosDeUtilidad(id: string, texto: string, columna?: Columna): { args: EntradaDe<'cuadro_fijar_utilidad'> } | { error: string } {
  const pct = limpiarEntrada(texto);
  const error = porcentajeDeUtilidadValido(pct);
  return error ? { error } : { args: { id, pct, ...(columna && { columna }) } };
}
export const argumentosDeBaseDeUtilidad = (id: string, base: 'venta' | 'costo'): EntradaDe<'cuadro_fijar_utilidad'> => ({ id, base });
export const argumentosDeQuitarUtilidadDeColumna = (id: string, columna: Columna): EntradaDe<'cuadro_fijar_utilidad'> => ({ id, pct: null, columna });

export type PrecioFinal = { precioCentimos: number | null } | { descuentoPct: string };
export const argumentosDePrecioFinal = (id: string, p: PrecioFinal): EntradaDe<'cuadro_fijar_precio_final'> => ({ id, ...p });
export function argumentosDeDescuento(id: string, texto: string): { args: EntradaDe<'cuadro_fijar_precio_final'> } | { error: string } {
  const d = limpiarEntrada(texto);
  const error = porcentajeDeUtilidadValido(d);
  return error ? { error } : { args: argumentosDePrecioFinal(id, { descuentoPct: d }) };
}

// --- Ítems del cuadro ---

export type FormularioDeItemDelCuadro = { nombre: string; factor: EntradaDe<'cuadro_item_agregar'>['factor']; fija: boolean; guardarEnTaller: boolean };
export const ITEM_NUEVO: FormularioDeItemDelCuadro = { nombre: '', factor: 'acabado', fija: false, guardarEnTaller: false };
export const validarItemDelCuadro = (f: FormularioDeItemDelCuadro): { nombre?: string } => (f.nombre.trim() === '' ? { nombre: 'Falta el nombre del ítem.' } : {});
export const argumentosDeItemNuevo = (id: string, f: FormularioDeItemDelCuadro): EntradaDe<'cuadro_item_agregar'> => ({
  id, nombre: f.nombre.trim(), factor: f.factor, fija: f.fija, guardarEnTaller: f.guardarEnTaller,
});
export const argumentosDeItemEditado = (id: string, fila: FilaDirecta, f: FormularioDeItemDelCuadro): EntradaDe<'cuadro_item_editar'> => ({
  id, item: fila.clave, nombre: f.nombre.trim(), factor: f.factor, fija: f.fija,
});
export const argumentosDeItemQuitado = (id: string, fila: FilaDirecta): EntradaDe<'cuadro_item_quitar'> => ({ id, item: fila.clave });
export const formularioDeItemDelCuadro = (f: FilaDirecta): FormularioDeItemDelCuadro => ({ nombre: f.nombre, factor: f.factor, fija: f.fija, guardarEnTaller: false });

// --- Guardar los tres precios en la lista de precios ---

export type FormularioDeReferencias = { nombre: string; productoId: string | null; modo: 'curva' | 'escalon'; minimoCentimos: Centimos | null; confirmarUnitarioNoBaja: boolean };
export const REFERENCIAS_VACIAS: FormularioDeReferencias = { nombre: '', productoId: null, modo: 'curva', minimoCentimos: null, confirmarUnitarioNoBaja: false };

export function argumentosDeReferencias(id: string, f: FormularioDeReferencias): EntradaDe<'cuadro_guardar_referencias'> {
  return {
    id, modoIntermedio: f.modo, confirmarUnitarioNoBaja: f.confirmarUnitarioNoBaja,
    ...(f.nombre.trim() && { nombre: f.nombre.trim() }),
    ...(f.productoId && { productoId: f.productoId }),
    ...(f.minimoCentimos !== null && f.minimoCentimos > 0 && { precioMinimoCentimos: f.minimoCentimos }),
  };
}
