import type { Respuesta } from '@capaz/shared';

// Lo que una herramienta devuelve al modelo. Siempre es un JSON válido y nunca pasa del máximo, y cuando falta algo lo dice:
// un corte mudo haría que el modelo afirme «ese pedido no existe» solo porque no cabía en la lista.

export const MAXIMO_DE_RESULTADO = 6000;
/** Por debajo de esto ni el envoltorio mínimo cabe: se sube a este valor en vez de devolver un JSON roto. */
const MINIMO_POSIBLE = 120;

type Cuerpo = Record<string, unknown>;

/** El envoltorio que ve el modelo. Nunca lleva el token ni el resumen de una confirmación: eso es de la persona. */
function envolver(r: Respuesta<unknown>): Cuerpo {
  if (r.ok) {
    return r.avisos.length > 0 ? { ok: true, datos: r.datos, avisos: r.avisos.map((a) => a.mensaje) } : { ok: true, datos: r.datos };
  }
  if ('error' in r) return { ok: false, error: r.error };
  return { ok: false, error: { codigo: 'confirmacion_solo_ui', mensaje: 'Esa acción la debe confirmar la persona desde la pantalla.' } };
}

/** Los campos vacíos no le dicen nada al modelo y se pagan en cada ronda siguiente: no viajan. */
const sinVacios = (cuerpo: Cuerpo): Cuerpo => JSON.parse(JSON.stringify(cuerpo, (_clave, valor: unknown) => (valor === null ? undefined : valor))) as Cuerpo;

const largo = (x: unknown): number => JSON.stringify(x)?.length ?? 0;

/** El arreglo de primer nivel que más pesa, dentro de `datos` (o `datos` mismo si es un arreglo). */
function arregloMasPesado(datos: unknown): { clave: string | null; lista: unknown[] } | null {
  if (Array.isArray(datos)) return { clave: null, lista: datos };
  if (datos === null || typeof datos !== 'object') return null;
  let mejor: { clave: string; lista: unknown[] } | null = null;
  let peso = -1;
  for (const [clave, valor] of Object.entries(datos as Cuerpo)) {
    if (!Array.isArray(valor)) continue;
    const p = largo(valor);
    if (p > peso) {
      peso = p;
      mejor = { clave, lista: valor };
    }
  }
  return mejor;
}

function conLista(cuerpo: Cuerpo, clave: string | null, lista: unknown[], n: number): string {
  const aviso = `Resultado INCOMPLETO: se muestran ${n} de ${lista.length}. Los demás existen y NO se ven aquí: no afirmes que algo no existe solo porque no aparece. Acota con filtros.`;
  const recortado = { mostrados: n, total: lista.length, aviso };
  const datos = cuerpo.datos;
  const nuevos =
    clave === null ? { items: lista.slice(0, n), _recortado: recortado } : { ...(datos as Cuerpo), [clave]: lista.slice(0, n), _recortado: recortado };
  return JSON.stringify({ ...cuerpo, datos: nuevos });
}

/** El mayor `n` con el que la lista recortada cabe, por búsqueda binaria (el tamaño crece con `n`). */
function mayorQueCabe(cuerpo: Cuerpo, clave: string | null, lista: unknown[], maximo: number): number {
  let bajo = 0;
  let alto = lista.length;
  while (bajo < alto) {
    const medio = Math.ceil((bajo + alto) / 2);
    if (conLista(cuerpo, clave, lista, medio).length <= maximo) bajo = medio;
    else alto = medio - 1;
  }
  return bajo;
}

/** Sin una lista que recortar: se conserva el principio del JSON, marcado como parcial. */
function parcial(cuerpo: Cuerpo, completo: string, maximo: number): string {
  const armar = (k: number) => JSON.stringify({ ok: cuerpo.ok, datos: { _recortado: { aviso: 'Resultado INCOMPLETO: solo se muestra el principio. No saques conclusiones de lo que falta.' }, parcial: completo.slice(0, k) } });
  let bajo = 0;
  let alto = completo.length;
  while (bajo < alto) {
    const medio = Math.ceil((bajo + alto) / 2);
    if (armar(medio).length <= maximo) bajo = medio;
    else alto = medio - 1;
  }
  return armar(bajo);
}

/**
 * Serializa la respuesta de una herramienta para el modelo, con un tope de caracteres. Si no cabe, recorta la lista más
 * grande y añade `_recortado` con cuántos se muestran de cuántos hay; si no hay lista, deja el principio marcado como parcial.
 */
export function recortar(respuesta: Respuesta<unknown>, maximo: number = MAXIMO_DE_RESULTADO): string {
  const tope = Math.max(maximo, MINIMO_POSIBLE);
  const cuerpo = sinVacios(envolver(respuesta));
  const completo = JSON.stringify(cuerpo);
  if (completo.length <= tope) return completo;

  const lista = arregloMasPesado(cuerpo.datos);
  if (lista) {
    const n = mayorQueCabe(cuerpo, lista.clave, lista.lista, tope);
    if (n > 0) return conLista(cuerpo, lista.clave, lista.lista, n);
  }
  return parcial(cuerpo, completo, tope);
}
