import { correcto, fallo, type Fallo, type Resultado } from '../base/resultado.js'
import {
  aTexto,
  CERO,
  decimal,
  dividir,
  esCero,
  esMayor,
  multiplicar,
  piso,
  restar,
  sumar,
  techo,
  type Decimal,
} from '../base/dinero.js'
import type { Linea } from './tipos/cotizacion.js'
import type {
  CodigoDeImposicion,
  Dimensiones,
  EntradaDeImposicion,
  ImposicionCalculada,
  Margenes,
  Reparto,
} from './tipos/imposicion.js'
import { calcularMermas } from './mermas.js'

type Area = { ancho: Decimal; alto: Decimal }
type RepartoExacto = { poses: Decimal; columnas: Decimal; filas: Decimal; girada: boolean }

function comoArea({ anchoCm, altoCm }: Dimensiones): Area {
  return { ancho: decimal(anchoCm), alto: decimal(altoCm) }
}

function esPositiva({ anchoCm, altoCm }: Dimensiones): boolean {
  return esMayor(anchoCm, CERO) && esMayor(altoCm, CERO)
}

/**
 * Cuántas piezas caben en un largo, con una calle entre cada dos: k piezas ocupan
 * k·p + (k − 1)·calle, así que k = ⌊(L + calle) / (p + calle)⌋. Cero si ni una cabe.
 */
function piezasEnLinea(disponible: Decimal, pieza: Decimal, calle: Decimal): Decimal {
  if (!esMayor(disponible, CERO)) return CERO
  return piso(dividir(sumar(disponible, calle), sumar(pieza, calle)))
}

function repartoEn(area: Area, pieza: Area, calle: Decimal, girada: boolean): RepartoExacto {
  const p = girada ? { ancho: pieza.alto, alto: pieza.ancho } : pieza
  const columnas = piezasEnLinea(area.ancho, p.ancho, calle)
  const filas = piezasEnLinea(area.alto, p.alto, calle)
  return { poses: multiplicar(columnas, filas), columnas, filas, girada }
}

// La pinza es una franja del pliego que la máquina agarra y no imprime. No se asume por qué
// borde entra el pliego a la máquina: se prueba en cada uno, y con la pieza derecha y girada.
// En empate se queda el primero (pinza en el alto, pieza derecha), para que sea estable.
function mejorReparto(pliego: Area, pieza: Area, calle: Decimal, pinza: Decimal): RepartoExacto {
  const areasUtiles: Area[] = [
    { ancho: pliego.ancho, alto: restar(pliego.alto, pinza) },
    { ancho: restar(pliego.ancho, pinza), alto: pliego.alto },
  ]
  const candidatos = areasUtiles.flatMap((area) =>
    [false, true].map((girada) => repartoEn(area, pieza, calle, girada)),
  )
  return candidatos.reduce((mejor, c) => (esMayor(c.poses, mejor.poses) ? c : mejor))
}

/**
 * Cuántas veces cabe la pieza en un pliego, con sangrado (por cada lado), calle y pinza,
 * en sus dos orientaciones. Las poses las calcula el motor, nunca se escriben a mano
 * (PRO-01). Sirve para el pliego de máquina y también para el madre.
 */
export function posesEnPliego(
  pieza: Dimensiones,
  pliego: Dimensiones,
  { sangradoCm, calleCm, pinzaCm }: Margenes,
): Resultado<Reparto, 'medida_invalida' | 'pieza_no_cabe'> {
  if (!esPositiva(pieza) || !esPositiva(pliego)) {
    return fallo('medida_invalida', 'Las medidas de la pieza y del pliego deben ser mayores que cero.')
  }
  const dosSangrados = multiplicar(sangradoCm, '2')
  const piezaConSangrado: Area = {
    ancho: sumar(pieza.anchoCm, dosSangrados),
    alto: sumar(pieza.altoCm, dosSangrados),
  }
  const reparto = mejorReparto(comoArea(pliego), piezaConSangrado, decimal(calleCm), decimal(pinzaCm))
  if (esCero(reparto.poses)) {
    return fallo('pieza_no_cabe', 'La pieza, con su sangrado, no cabe en el pliego.')
  }
  return correcto({
    poses: aTexto(reparto.poses),
    columnas: aTexto(reparto.columnas),
    filas: aTexto(reparto.filas),
    girada: reparto.girada,
  })
}

/**
 * Pliegos de máquina que salen de un pliego madre con cortes de guillotina: sin calle,
 * sangrado ni pinza, y en la mejor de las dos orientaciones. Con 70 × 100 y 35 × 50 salen 4.
 */
export function pliegosPorMadre(madre: Dimensiones, maquina: Dimensiones): Decimal {
  const m = comoArea(madre)
  const p = comoArea(maquina)
  const derecho = multiplicar(piezasEnLinea(m.ancho, p.ancho, CERO), piezasEnLinea(m.alto, p.alto, CERO))
  const girado = multiplicar(piezasEnLinea(m.ancho, p.alto, CERO), piezasEnLinea(m.alto, p.ancho, CERO))
  return esMayor(girado, derecho) ? girado : derecho
}

/** ¿Cabe el pliego en el formato máximo de la máquina? Vale girado: se comparan lado menor y mayor. */
export function cabeEnFormato(pliego: Dimensiones, maximo: Dimensiones): boolean {
  const lados = ({ anchoCm, altoCm }: Dimensiones) =>
    esMayor(anchoCm, altoCm) ? [decimal(altoCm), decimal(anchoCm)] : [decimal(anchoCm), decimal(altoCm)]
  const [menor, mayor] = lados(pliego)
  const [menorMax, mayorMax] = lados(maximo)
  return !esMayor(menor, menorMax) && !esMayor(mayor, mayorMax)
}

function validarEntrada({
  pieza,
  cantidad,
  imposicion: imp,
}: EntradaDeImposicion): Fallo<CodigoDeImposicion> | null {
  const dimensiones = [pieza, imp.pliegoMadre, imp.pliegoMaquina]
  if (imp.formatoMaximo) dimensiones.push(imp.formatoMaximo)
  if (!dimensiones.every(esPositiva)) {
    return {
      codigo: 'medida_invalida',
      mensaje: 'Las medidas de la pieza, los pliegos y el formato máximo deben ser mayores que cero.',
    }
  }
  if (!esMayor(cantidad, CERO)) {
    return { codigo: 'cantidad_invalida', mensaje: 'La cantidad debe ser mayor que cero.' }
  }
  if (imp.formatoMaximo && !cabeEnFormato(imp.pliegoMaquina, imp.formatoMaximo)) {
    const { pliegoMaquina: p, formatoMaximo: f } = imp
    return {
      codigo: 'pliego_excede_formato',
      mensaje: `El pliego de máquina (${p.anchoCm} × ${p.altoCm} cm) no cabe en el formato máximo de la máquina (${f.anchoCm} × ${f.altoCm} cm).`,
    }
  }
  return null
}

/**
 * Del trabajo al papel, en dos niveles (INF-03): poses en el pliego de máquina → pliegos
 * netos → mermas por etapa hacia atrás → pliegos de máquina brutos → pliegos madre que hay
 * que comprar. Devuelve cada paso, para mostrarlos. Función pura: todo llega por parámetro.
 */
export function calcularImposicion(
  entrada: EntradaDeImposicion,
): Resultado<ImposicionCalculada, CodigoDeImposicion> {
  const invalida = validarEntrada(entrada)
  if (invalida) return { ok: false, error: invalida }

  const { pieza, cantidad, imposicion: imp } = entrada
  const reparto = posesEnPliego(pieza, imp.pliegoMaquina, imp)
  if (!reparto.ok) return reparto

  const porMadre = pliegosPorMadre(imp.pliegoMadre, imp.pliegoMaquina)
  if (esCero(porMadre)) {
    return fallo('maquina_no_cabe_en_madre', 'El pliego de máquina no cabe en el pliego madre.')
  }

  const netos = techo(dividir(cantidad, reparto.valor.poses))
  const mermas = calcularMermas(netos, imp.etapas)
  if (!mermas.ok) return mermas

  return correcto({
    ...reparto.valor,
    pliegosNetos: aTexto(netos),
    etapas: mermas.valor.etapas,
    pliegosDeMaquina: mermas.valor.bruto,
    pliegosPorMadre: aTexto(porMadre),
    pliegosMadre: aTexto(techo(dividir(mermas.valor.bruto, porMadre))),
  })
}

/** Lo que pone quien elige el papel: el motor solo sabe cuántos pliegos madre hacen falta. */
export type PapelElegido = { id: string; descripcion: string; unidad: string; costoUnitario: string }

/**
 * La fila de material del cuadro, con los pliegos madre que calculó la imposición. El precio
 * y la unidad los pone quien elige el papel (el catálogo o el usuario), no el motor.
 */
export function filaDePapel(
  calculada: Pick<ImposicionCalculada, 'pliegosMadre'>,
  papel: PapelElegido,
): Linea {
  return { ...papel, factor: 'material', cantidad: calculada.pliegosMadre, escala: 'por_pliego' }
}
