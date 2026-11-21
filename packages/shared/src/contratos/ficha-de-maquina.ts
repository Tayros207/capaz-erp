import { z } from 'zod';

// La ficha de máquina de una línea de trabajo: material, medida, colores y acabado (texto libre y opcional, como SF 009 y Producción).
// La usan las líneas del pedido (`ordenes`) y las de la orden de trabajo del taller (`produccion`). Nunca se adivina ni se dicta.

export const CAMPOS_DE_FICHA = ['material', 'medida', 'colores', 'acabado'] as const;
export type CampoDeFicha = (typeof CAMPOS_DE_FICHA)[number];
export const MAXIMO_DE_CAMPO_DE_FICHA = 120;
export const ETIQUETA_DE_CAMPO_DE_FICHA: Readonly<Record<CampoDeFicha, string>> = { material: 'Material', medida: 'Medida', colores: 'Colores', acabado: 'Acabado' };
/** Ejemplos para los campos vacíos (los de SF y Producción). */
export const EJEMPLO_DE_CAMPO_DE_FICHA: Readonly<Record<CampoDeFicha, string>> = { material: 'couché 150g', medida: 'A5', colores: 'full color', acabado: 'plastificado' };

export type FichaDeMaquina = Record<CampoDeFicha, string | null>;
export type FichaParcial = Partial<Record<CampoDeFicha, string | null | undefined>>;

const campoDeEntrada = z.string().trim().max(MAXIMO_DE_CAMPO_DE_FICHA, { error: `Cada dato de la ficha de máquina admite hasta ${MAXIMO_DE_CAMPO_DE_FICHA} caracteres.` }).nullish();
const campoDeSalida = z.string().nullable();

/** Entrada: cada campo opcional; vacío o `null` = sin dato. */
export const fichaDeEntradaShape = { material: campoDeEntrada, medida: campoDeEntrada, colores: campoDeEntrada, acabado: campoDeEntrada };
/** Salida: los cuatro siempre presentes (`null` = sin dato). */
export const fichaDeSalidaShape = { material: campoDeSalida, medida: campoDeSalida, colores: campoDeSalida, acabado: campoDeSalida };
/** Huella de una corrección: opcional, las huellas anteriores a la 0036 no la traen. */
export const fichaDeHuellaShape = { material: campoDeSalida.optional(), medida: campoDeSalida.optional(), colores: campoDeSalida.optional(), acabado: campoDeSalida.optional() };

/** `'  A5 '` → `'A5'`; vacío, solo espacios, `null` o ausente → `null`. */
export const normalizarCampoDeFicha = (v: string | null | undefined): string | null => v?.trim() || null;

export const fichaNormalizada = (f: FichaParcial): FichaDeMaquina => ({
  material: normalizarCampoDeFicha(f.material),
  medida: normalizarCampoDeFicha(f.medida),
  colores: normalizarCampoDeFicha(f.colores),
  acabado: normalizarCampoDeFicha(f.acabado),
});

/** Solo los campos con algo escrito, recortados (pedido_crear/pedido_editar: lo que no va queda vacío). */
export function fichaSinVacios(f: FichaParcial): Partial<Record<CampoDeFicha, string>> {
  const salida: Partial<Record<CampoDeFicha, string>> = {};
  for (const c of CAMPOS_DE_FICHA) {
    const v = normalizarCampoDeFicha(f[c]);
    if (v !== null) salida[c] = v;
  }
  return salida;
}

export const mismaFicha = (a: FichaParcial, b: FichaParcial): boolean => CAMPOS_DE_FICHA.every((c) => normalizarCampoDeFicha(a[c]) === normalizarCampoDeFicha(b[c]));
export const tieneFicha = (f: FichaParcial): boolean => CAMPOS_DE_FICHA.some((c) => normalizarCampoDeFicha(f[c]) !== null);

/** «couché 150g · A5 · full color» (solo lo escrito, en orden); '' si no hay nada. Para lo que va al cliente. */
export const textoDeFicha = (f: FichaParcial): string =>
  CAMPOS_DE_FICHA.map((c) => normalizarCampoDeFicha(f[c])).filter((v): v is string => v !== null).join(' · ');

/** «Material: couché 150g · Medida: A5». Para la orden de trabajo. */
export const textoDeFichaConEtiquetas = (f: FichaParcial): string =>
  CAMPOS_DE_FICHA.flatMap((c) => {
    const v = normalizarCampoDeFicha(f[c]);
    return v ? [`${ETIQUETA_DE_CAMPO_DE_FICHA[c]}: ${v}`] : [];
  }).join(' · ');
