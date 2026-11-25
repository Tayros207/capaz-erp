// REGLA NUEVA (A2): cómo se decide entre lo que leyeron las reglas y lo que entendió el modelo. Puro: solo dictado/.
//  - Dinero y fechas: lo leído por las reglas MANDA; el modelo solo completa lo que ellas no encontraron. Si los dos discrepan, queda
//    lo de las reglas y se avisa. Si el modelo aporta un importe que no aparece tal cual en el texto, se usa pero también se avisa.
//  - Nombres: el del modelo, solo si todas sus palabras están en lo dictado (no inventa nombres).
import { formatearNombreDeContacto } from './reglas/descripcion.js';
import { montoEnPalabrasSoles } from './reglas/numeros-en-palabras.js';
import { milesimasDeNumero, sinTildes } from './reglas/pedido-texto.js';

export type ValorDictado =
  | { tipo: 'centimos'; valor: number }
  | { tipo: 'milesimas'; valor: number }
  | { tipo: 'dia'; valor: string }
  | { tipo: 'texto'; valor: string };

/** Se convierten en texto para `faltan` fuera de dictado/ (avisos-del-modelo.ts), donde se puede formatear con @capaz/shared. */
export type AvisoDelModelo =
  | { motivo: 'distinto'; campo: string; reglas: ValorDictado; modelo: ValorDictado }
  | { motivo: 'no_aparece'; campo: string; modelo: ValorDictado }
  | { motivo: 'no_entendida'; campo: string; modelo: ValorDictado };

/** Un texto vacío del modelo es lo mismo que no decir nada. */
export const vacioANulo = (t: string | null | undefined): string | null => (t && t.trim() ? t.trim() : null);

const CIFRA = /(?<![\p{L}\d])([1-9]\d{0,2}(?:,\d{3})+|\d+(?:[.,]\d{1,3})?)(?![\p{L}\d])/gu;

/** Todas las cifras del texto en milésimas, más el importe dicho en palabras («ochenta soles»). */
function cifrasEnMilesimas(texto: string): Set<number> {
  const cifras = new Set<number>();
  for (const m of texto.matchAll(CIFRA)) {
    const v = milesimasDeNumero(m[1]!);
    if (v !== null) cifras.add(v);
  }
  const enPalabras = montoEnPalabrasSoles(texto);
  if (enPalabras !== null) cifras.add(enPalabras * 1000);
  return cifras;
}

export const centimosEnElTexto = (centimos: number, texto: string): boolean => cifrasEnMilesimas(texto).has(centimos * 10);
export const milesimasEnElTexto = (milesimas: number, texto: string): boolean => cifrasEnMilesimas(texto).has(milesimas);

const palabras = (t: string): string[] => sinTildes(t).match(/\p{L}+/gu) ?? [];

/** ¿Cada palabra del nombre está en lo dictado? Sin tildes ni mayúsculas. */
export function nombreEnElTexto(nombre: string, texto: string): boolean {
  const delTexto = new Set(palabras(texto));
  const delNombre = palabras(nombre);
  return delNombre.length > 0 && delNombre.every((p) => delTexto.has(p));
}

/** El nombre que dio el modelo, ya con mayúsculas de nombre, o null si no se dijo o no está en el texto. */
export function nombreDelModelo(nombre: string | null, texto: string): string | null {
  const n = vacioANulo(nombre);
  return n && nombreEnElTexto(n, texto) ? formatearNombreDeContacto(n) : null;
}

/** Un importe en céntimos: manda lo leído por las reglas; el modelo completa. */
export function elegirCentimos(campo: string, reglas: number | null, modelo: number | null, texto: string, avisos: AvisoDelModelo[]): number | null {
  if (modelo === null || modelo === reglas) return reglas;
  if (reglas !== null) {
    avisos.push({ motivo: 'distinto', campo, reglas: { tipo: 'centimos', valor: reglas }, modelo: { tipo: 'centimos', valor: modelo } });
    return reglas;
  }
  if (!centimosEnElTexto(modelo, texto)) avisos.push({ motivo: 'no_aparece', campo, modelo: { tipo: 'centimos', valor: modelo } });
  return modelo;
}

/** Una fecha: manda la de las reglas; si no hay, la expresión que copió el modelo, resuelta aquí con `resolver`. */
export function elegirDia(
  campo: string,
  reglas: string | null,
  expresion: string | null,
  resolver: (expresion: string) => string | null,
  avisos: AvisoDelModelo[],
): string | null {
  const dicha = vacioANulo(expresion);
  if (dicha === null) return reglas;
  const delModelo = resolver(dicha);
  if (delModelo === null) {
    if (reglas === null) avisos.push({ motivo: 'no_entendida', campo, modelo: { tipo: 'texto', valor: dicha } });
    return reglas;
  }
  if (reglas !== null && reglas !== delModelo) {
    avisos.push({ motivo: 'distinto', campo, reglas: { tipo: 'dia', valor: reglas }, modelo: { tipo: 'dia', valor: delModelo } });
    return reglas;
  }
  return delModelo;
}
