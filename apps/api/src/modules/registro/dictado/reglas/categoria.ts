/**
 * Inferencia LOCAL de categoria contable.
 *
 * Es el plan B de la clasificacion: si el LLM no devuelve categoria (o devuelve
 * una que no existe, o la llamada falla), esto la deduce por vocabulario de
 * imprenta. No pretende ser inteligente, pretende no equivocarse: ante la duda
 * devuelve null y la UI le pregunta al dueño.
 *
 * Tres reglas de diseño, en orden de importancia:
 *
 *   1. EL TIPO MANDA. Una compra jamas puede caer en "impresion offset". Se
 *      filtran las reglas por `categoriaCoincideConTipo` ANTES de buscar, asi
 *      que la misma palabra puede significar cosas distintas segun entre o
 *      salga plata ("offset" el servicio que vendes vs la maquina que reparas,
 *      "plastificado" que te cobra un tercero vs el que tu facturas).
 *
 *   2. GANA LA COINCIDENCIA MAS LARGA. Cuando varias categorias casan, se
 *      elige la del texto coincidente mas largo, porque mas caracteres = frase
 *      mas especifica: "mantenimiento del taller" (local) le gana a
 *      "mantenimiento" (maquinaria), y "arbitrios municipales" (impuestos) le
 *      gana a "arbitrio" (local). Empate a longitud → gana la regla declarada
 *      primero, por eso el orden de REGLAS no es alfabetico sino de prioridad.
 *
 *   3. SIN COINCIDENCIA, NULL. Nunca se devuelve "otros_egresos"/"otros_ingresos"
 *      como relleno: un movimiento sin clasificar se ve y se corrige, uno mal
 *      clasificado envenena los reportes en silencio.
 */

import {
  categoriaCoincideConTipo,
  esCategoriaValida,
  type Categoria,
} from './categorias-de-rubro.js'

/**
 * Minusculas y sin tildes. Misma normalizacion que `normalizeContactName`
 * (src/shared/lib/contactos.ts), duplicada a proposito: si algun dia el
 * matching de nombres cambia (p.ej. quitar puntuacion), la clasificacion de
 * dinero no deberia cambiar con el.
 *
 * Efecto util: "diseño" → "diseno", que es exactamente el valor de la
 * categoria en el catalogo.
 */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

interface Regla {
  readonly categoria: Categoria
  readonly patron: RegExp
}

/**
 * Compila las alternativas en un solo regex delimitado por `\b`.
 *
 * Las ordena de mas larga a mas corta porque JS elige la PRIMERA alternativa
 * que casa en la posicion mas temprana, no la mas larga: con "alquiler" antes
 * que "alquiler de maquina", la frase completa reportaria solo 8 caracteres y
 * perderia el desempate de la regla 2.
 *
 * Sin flag /g: los regex se reutilizan entre llamadas y `lastIndex` haria que
 * la segunda invocacion diera resultados distintos a la primera.
 */
function regla(categoria: Categoria, ...alternativas: string[]): Regla {
  const ordenadas = [...alternativas].sort((a, b) => b.length - a.length)
  return { categoria, patron: new RegExp(`\\b(?:${ordenadas.join('|')})\\b`) }
}

/**
 * Acabados: mismo vocabulario, dos categorias segun el sentido del dinero.
 * Si lo pagas es servicio de un tercero (egreso); si lo cobras es tu acabado
 * (ingreso). El filtro por tipo hace la desambiguacion sola.
 */
const ACABADOS = [
  'acabados?',
  'plastificad(?:o|os|a|as)',
  'plastificar',
  'laminad(?:o|os|a|as)',
  'laminacion',
  'troquelad(?:o|os|a|as)',
  'troquel(?:es)?',
  'encuadernad(?:o|os|a|as)',
  'encuadernacion',
  'empastad(?:o|os|a|as)',
  'empaste',
  'anillad(?:o|os|a|as)',
  'espiralad(?:o|os|a|as)',
  'grapad(?:o|os)',
]

/**
 * Orden = prioridad ante empate de longitud. Primero lo que un dueño de
 * imprenta compra/vende todos los dias, al final los gastos genericos cuyas
 * palabras ("local", "recibo") son mas propensas a aparecer de refilon.
 */
const REGLAS: readonly Regla[] = [
  // ---------------------------------------------------------------- Egresos
  regla(
    'materia_prima',
    'papel(?:es)?',
    'cartulinas?',
    'couche',
    'cuche',
    'folcote',
    'foldcote',
    'bond',
    'duplex',
    'opalina',
    'adhesivos?',
    'pliegos?',
    'resmas?',
    'millar(?:es)? de papel',
    'cartones?',
    'kraft',
    'sulfito',
    // Vinil y lona no estan en los ejemplos del catalogo, pero cuando se
    // COMPRAN son materia prima; como gran_formato solo existe para ingresos,
    // sin esto una compra de vinil se quedaria sin clasificar.
    'vinil(?:o|os|es)?',
    'lonas?'
  ),
  regla(
    'insumos',
    'tintas?',
    'planchas?',
    'quimicos?',
    'revelador(?:es)?',
    'barni(?:z|ces)',
    'solventes?',
    'alcohol isopropilico',
    'alcohol',
    'gomas?',
    'cola',
    'toner',
    'thinner',
    'grapas?'
  ),
  regla('acabados_terceros', ...ACABADOS),
  regla(
    'mano_obra',
    'sueldos?',
    'salarios?',
    'planillas?',
    'jornal(?:es)?',
    'destajo',
    'operarios?',
    'practicantes?',
    'pago al personal',
    'al personal',
    'personal',
    'obreros?',
    'ayudantes?',
    // Al diseñador se le paga por su trabajo: "diseno" es la categoria de lo
    // que se COBRA por diseñar, no la de lo que cuesta que alguien diseñe.
    'disenador(?:a|es|as)?',
    'gratificacion(?:es)?'
  ),
  regla(
    'maquinaria',
    'repuestos?',
    'mantenimiento',
    'tecnicos?',
    'rodillos?',
    'mantill(?:a|as|o|os)',
    'guillotinas?',
    'alquiler de (?:la |una )?maquina',
    'alquiler de (?:la |una )?impresora',
    'maquina offset',
    'prensa offset',
    'la offset',
    'reparacion',
    'reparar',
    'maquinas?'
  ),
  regla(
    'transporte',
    // "flete de la cartulina" es transporte, no materia prima: lo que se paga
    // es el traslado. Se captura el complemento entero para que la frase gane
    // por longitud a la palabra del material.
    'fletes? de (?:la |el |los |las )?[a-z]+',
    'envios? de (?:la |el |los |las )?[a-z]+',
    'movilidad(?:es)?',
    'taxis?',
    'mototaxis?',
    'fletes?',
    'envios?',
    'gasolina',
    'combustible',
    'petroleo',
    'pasajes?',
    'courier',
    'delivery',
    'peajes?'
  ),
  regla(
    'impuestos',
    'sunat',
    'igv',
    'impuesto a la renta',
    'impuestos?',
    'renta',
    'tributos?',
    'multas?',
    'detraccion(?:es)?',
    // El catalogo pone los arbitrios municipales en impuestos y el arbitrio
    // suelto en local; la frase larga gana por la regla 2.
    'arbitrios? municipal(?:es)?'
  ),
  regla(
    'servicios',
    'recibo de luz',
    'recibo de agua',
    'recibos?',
    'luz',
    'electricidad',
    'agua',
    'internet',
    'telefonos?',
    'celular',
    'cable',
    'wifi'
  ),
  regla(
    'local',
    'mantenimiento del (?:local|taller)',
    'alquiler del (?:local|taller)',
    'renta del (?:local|taller)',
    'alquiler',
    'arbitrios?',
    'local',
    'talleres?'
  ),

  // --------------------------------------------------------------- Ingresos
  regla(
    'gran_formato',
    'gigantografias?',
    'banners?',
    'vinil(?:o|os|es)?',
    'roll ?ups?',
    'lonas?',
    'letreros?',
    'pancartas?',
    'gran formato'
  ),
  regla(
    'impresion_digital',
    'tarjetas? de presentacion',
    'tarjetas?',
    'impresion digital',
    'digital(?:es)?',
    'full color',
    'tiraje corto',
    'fotocopias?'
  ),
  regla(
    'impresion_offset',
    // Combinaciones explicitas: "millar de volantes full color" debe ser
    // offset, y sin ellas "full color" (digital) ganaria por ser mas largo.
    // El tiraje largo de volantes/afiches sale en offset aunque sea a color.
    'millar(?:es)? de (?:volantes|afiches|dipticos|tripticos|folletos)',
    '(?:volantes|afiches|dipticos|tripticos|folletos|revistas) full color',
    'millar(?:es)?',
    'volantes?',
    'afiches?',
    'revistas?',
    'periodicos?',
    'dipticos?',
    'tripticos?',
    'folletos?',
    'catalogos?',
    'talonarios?',
    'offset',
    'tirajes?'
  ),
  regla('acabados', ...ACABADOS),
  regla(
    'diseno',
    'disen(?:o|os|ar)',
    'diagramacion',
    'logotipos?',
    'logos?',
    'arte final',
    'artes?',
    'retoque',
    'ilustracion(?:es)?'
  ),
]

/**
 * Fragmentos a evaluar, en orden de preferencia.
 *
 * Lo dictado antes de "para" es lo que se compra; lo de despues es el motivo.
 * En "compre tinta para la offset" el gasto es tinta (insumos), no la maquina.
 * Si la clausula principal no clasifica, se reintenta con la frase entera para
 * no perder casos como "pague 100 para el alquiler".
 */
function fragmentos(normalizado: string): string[] {
  const principal = normalizado.split(/\bpara\b/)[0].trim()
  if (principal.length >= 3 && principal.length < normalizado.length) {
    return [principal, normalizado]
  }
  return [normalizado]
}

/** Coincidencia mas larga del fragmento. Empate → la regla declarada antes. */
function mejorCoincidencia(fragmento: string, reglas: readonly Regla[]): Categoria | null {
  let ganadora: Categoria | null = null
  let largo = 0

  for (const r of reglas) {
    const m = r.patron.exec(fragmento)
    if (m && m[0].length > largo) {
      largo = m[0].length
      ganadora = r.categoria
    }
  }

  return ganadora
}

/**
 * Categoria probable del movimiento, o null si el texto no da señales claras.
 * Siempre devuelve un valor del catalogo cerrado y siempre compatible con
 * `tipo`.
 */
export function inferirCategoria(texto: string, tipo: 'ingreso' | 'egreso'): Categoria | null {
  if (typeof texto !== 'string' || texto.trim().length === 0) return null

  const aplicables = REGLAS.filter((r) => categoriaCoincideConTipo(r.categoria, tipo))
  const normalizado = normalizar(texto)

  for (const fragmento of fragmentos(normalizado)) {
    const hit = mejorCoincidencia(fragmento, aplicables)
    if (hit) return hit
  }

  return null
}

/**
 * Minimo de movimientos previos para que el historial opine. Con uno solo no
 * hay habito: seria repetir la clasificacion de la primera vez, incluida su
 * eventual equivocacion.
 */
export const MINIMO_REGISTROS = 2

/**
 * Fraccion que debe alcanzar la categoria dominante. Con 60% hay mayoria real
 * (en un empate 50/50 o un 4/3 no la hay) y aun asi se acepta ruido: un
 * proveedor que 3 de 5 veces vende cartulina sigue siendo un proveedor de
 * materia prima. Es una SUGERENCIA para precargar el selector, no un dato
 * contable: el costo de fallar es que el dueño cambie el chip.
 */
export const DOMINANCIA_MINIMA = 0.6

/**
 * Sugiere la categoria habitual de un contacto a partir de su historial.
 * Entradas con categorias fuera del catalogo se ignoran por completo (son
 * movimientos sin clasificar o de una version anterior del catalogo: no
 * cuentan ni a favor ni en contra).
 */
export function sugerirPorHistorial(
  historial: { categoria: string; veces: number }[]
): Categoria | null {
  const conteo = new Map<Categoria, number>()

  for (const fila of historial) {
    if (!esCategoriaValida(fila.categoria)) continue
    if (!Number.isFinite(fila.veces) || fila.veces <= 0) continue
    conteo.set(fila.categoria, (conteo.get(fila.categoria) ?? 0) + fila.veces)
  }

  const total = [...conteo.values()].reduce((a, b) => a + b, 0)
  if (total < MINIMO_REGISTROS) return null

  let dominante: Categoria | null = null
  let maximo = 0
  let empatada = false

  for (const [categoria, veces] of conteo) {
    if (veces > maximo) {
      maximo = veces
      dominante = categoria
      empatada = false
    } else if (veces === maximo) {
      empatada = true
    }
  }

  // Empate en el maximo = no hay dominante, aunque la fraccion diera el ancho.
  if (dominante === null || empatada) return null

  return maximo / total >= DOMINANCIA_MINIMA ? dominante : null
}
