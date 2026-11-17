import type { EntradaDe, TarifaDelTallerDto } from '@capaz/shared';
import { costoValido, limpiarEntrada, mostrarDecimal, type Escala, type Factor } from '../logica-taller.ts';
import type { Fila, Vista } from './logica-cuadro.ts';

// Filas por factor, trabajo e imposición: formularios, validación y armado de argumentos. Los números viajan como texto.

const CANTIDAD = /^\d{1,9}(\.\d{1,3})?$/;
const MEDIDA = /^\d{1,5}(\.\d{1,2})?$/;

export const cantidadDeFilaValida = (t: string): string | undefined => {
  const v = limpiarEntrada(t);
  if (v === '') return 'Falta la cantidad.';
  return CANTIDAD.test(v) ? undefined : 'Escribe un número con hasta 3 decimales.';
};

export type FormularioDeFila = { tarifa: TarifaDelTallerDto | null; factor: Factor; descripcion: string; cantidad: string; unidad: string; costoUnitario: string; escala: Escala };
export const FILA_VACIA: FormularioDeFila = { tarifa: null, factor: 'acabado', descripcion: '', cantidad: '1', unidad: 'unidad', costoUnitario: '', escala: 'fija' };
export type ErroresDeFila = Partial<Record<'tarifa' | 'descripcion' | 'cantidad' | 'unidad' | 'costoUnitario', string>>;

/** El formulario de una fila existente; el costo solo viene si la persona tiene el permiso de costos. */
export const formularioDeFila = (f: Fila): FormularioDeFila => ({
  tarifa: null, factor: f.factor, descripcion: f.descripcion, cantidad: mostrarDecimal(f.cantidad), unidad: f.unidad,
  costoUnitario: f.interno ? mostrarDecimal(f.interno.costoUnitario) : '', escala: f.escala,
});

/** Con tarifa se copian nombre, unidad y costo; a mano hacen falta descripción, unidad y costo. */
export function validarFila(f: FormularioDeFila, aMano: boolean, pideCosto: boolean): ErroresDeFila {
  const e: ErroresDeFila = {};
  const cantidad = cantidadDeFilaValida(f.cantidad);
  if (cantidad) e.cantidad = cantidad;
  if (!aMano && !f.tarifa) e.tarifa = 'Elige una tarifa o escribe la fila a mano.';
  if (aMano && f.descripcion.trim() === '') e.descripcion = 'Falta la descripción.';
  if (aMano && f.unidad.trim() === '') e.unidad = 'Falta la unidad.';
  if (aMano && pideCosto) {
    const costo = costoValido(f.costoUnitario);
    if (costo) e.costoUnitario = costo;
  }
  return e;
}

export function argumentosDeFilaNueva(id: string, f: FormularioDeFila, aMano: boolean): EntradaDe<'cuadro_linea_agregar'> {
  const cantidad = limpiarEntrada(f.cantidad);
  if (!aMano && f.tarifa) return { id, tarifaId: f.tarifa.id, cantidad };
  return { id, factor: f.factor, descripcion: f.descripcion.trim(), cantidad, unidad: f.unidad.trim(), costoUnitario: limpiarEntrada(f.costoUnitario), escala: f.escala };
}

/** Las ediciones de una fila van de a un campo: solo se envía lo que cambió. */
export function cambiosDeFila(original: FormularioDeFila, nuevo: FormularioDeFila, pideCosto: boolean): Array<{ campo: 'descripcion' | 'cantidad' | 'unidad' | 'costoUnitario' | 'escala' | 'factor'; valor: string }> {
  const lista: Array<{ campo: 'descripcion' | 'cantidad' | 'unidad' | 'costoUnitario' | 'escala' | 'factor'; valor: string }> = [];
  if (nuevo.descripcion.trim() !== original.descripcion) lista.push({ campo: 'descripcion', valor: nuevo.descripcion.trim() });
  if (limpiarEntrada(nuevo.cantidad) !== original.cantidad) lista.push({ campo: 'cantidad', valor: limpiarEntrada(nuevo.cantidad) });
  if (nuevo.unidad.trim() !== original.unidad) lista.push({ campo: 'unidad', valor: nuevo.unidad.trim() });
  if (pideCosto && limpiarEntrada(nuevo.costoUnitario) !== original.costoUnitario) lista.push({ campo: 'costoUnitario', valor: limpiarEntrada(nuevo.costoUnitario) });
  if (nuevo.escala !== original.escala) lista.push({ campo: 'escala', valor: nuevo.escala });
  if (nuevo.factor !== original.factor) lista.push({ campo: 'factor', valor: nuevo.factor });
  return lista;
}

export const argumentosDeQuitarFila = (id: string, f: Fila): EntradaDe<'cuadro_linea_quitar'> => ({ id, linea: { id: f.id } });

// --- Trabajo e imposición ---

export type CampoDeTrabajo = 'producto' | 'descripcion' | 'cantidad' | 'anchoCm' | 'altoCm' | 'tintas' | 'caras';
export type CambioDeTrabajo = { args: EntradaDe<'cuadro_fijar_trabajo'> } | { error: string } | null;

const entero = (t: string, min: number, max: number): number | null => (/^\d{1,2}$/.test(t.trim()) && Number(t) >= min && Number(t) <= max ? Number(t) : null);

/** Lo que se tecleó en un campo del trabajo, hecho llamada al servidor; `null` si no cambió nada. */
export function cambioDeTrabajo(v: Vista, id: string, campo: CampoDeTrabajo, texto: string): CambioDeTrabajo {
  const t = v.trabajo;
  const limpio = limpiarEntrada(texto);
  if (campo === 'producto' || campo === 'descripcion') {
    return texto.trim() === (t[campo] ?? '') ? null : { args: { id, [campo]: texto.trim() } };
  }
  if (campo === 'cantidad') {
    if (!CANTIDAD.test(limpio)) return { error: 'Escribe una cantidad con hasta 3 decimales.' };
    return limpio === t.cantidad ? null : { args: { id, cantidad: limpio } };
  }
  if (campo === 'tintas' || campo === 'caras') {
    const n = entero(texto, campo === 'tintas' ? 0 : 1, campo === 'tintas' ? 12 : 2);
    if (n === null) return { error: campo === 'tintas' ? 'Las tintas van de 0 a 12.' : 'Las caras son 1 o 2.' };
    return n === t[campo] ? null : { args: { id, [campo]: n } };
  }
  if (!MEDIDA.test(limpio)) return { error: 'Escribe una medida con hasta 2 decimales.' };
  const otra = campo === 'anchoCm' ? t.pieza?.altoCm : t.pieza?.anchoCm;
  if (!otra) return { error: 'Indica primero la otra medida de la pieza.' };
  const pieza = campo === 'anchoCm' ? { anchoCm: limpio, altoCm: otra } : { anchoCm: otra, altoCm: limpio };
  return t.pieza && pieza.anchoCm === t.pieza.anchoCm && pieza.altoCm === t.pieza.altoCm ? null : { args: { id, pieza } };
}

export type CampoDeMedida = 'sangradoCm' | 'calleCm' | 'pinzaCm';
export function cambioDeMedida(v: Vista, id: string, campo: CampoDeMedida, texto: string): { args: EntradaDe<'cuadro_fijar_imposicion'> } | { error: string } | null {
  const limpio = limpiarEntrada(texto);
  if (!MEDIDA.test(limpio)) return { error: 'Escribe una medida con hasta 2 decimales.' };
  return limpio === v.imposicion.parametros[campo] ? null : { args: { id, [campo]: limpio } };
}

/** Un alto y ancho para mostrar: «21 × 14.8 cm». */
export const textoDeDimensiones = (d: { anchoCm: string; altoCm: string } | null): string => (d ? `${mostrarDecimal(d.anchoCm)} × ${mostrarDecimal(d.altoCm)} cm` : 'Sin definir');
