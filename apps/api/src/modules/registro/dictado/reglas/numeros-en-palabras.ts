/**
 * Numeros dichos en palabras: «trescientos cincuenta soles».
 *
 * Vive en shared porque hacen falta en las dos lecturas del dictado —el
 * movimiento del chat y la orden de trabajo— y la de las ordenes no los tenia:
 * «Cristina, tarjetas, ciento cincuenta soles» se quedaba SIN NINGUN TRABAJO,
 * porque solo se buscaban cifras con digitos.
 *
 * Devuelve tambien DONDE esta el numero, para que quien llama pueda separar la
 * descripcion de su importe sin tener que buscarlo otra vez.
 */

const UNIDADES: Record<string, number> = {
  cero: 0, uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22,
  veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26,
  veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}

const CENTENAS: Record<string, number> = {
  doscientos: 200, doscientas: 200, trescientos: 300, trescientas: 300,
  cuatrocientos: 400, cuatrocientas: 400, quinientos: 500, quinientas: 500,
  seiscientos: 600, seiscientas: 600, setecientos: 700, setecientas: 700,
  ochocientos: 800, ochocientas: 800, novecientos: 900, novecientas: 900,
}

const ESCALAS: Record<string, number> = {
  cien: 100, ciento: 100, mil: 1000, millon: 1_000_000, millones: 1_000_000,
}

function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Cuanto vale una palabra suelta, o null si no es un numero. */
export function valorPalabraNumero(palabra: string): number | null {
  const p = sinTildes(palabra)
  if (p in UNIDADES) return UNIDADES[p]
  if (p in CENTENAS) return CENTENAS[p]
  if (p in ESCALAS) return ESCALAS[p]
  return null
}

/** Suma un tramo ya aislado: «trescientos cincuenta» -> 350. */
function sumarTramo(palabras: readonly string[]): number | null {
  let total = 0
  let current = 0

  for (const bruto of palabras) {
    const p = sinTildes(bruto)
    if (p === 'y') continue

    if (p in UNIDADES) {
      current += UNIDADES[p]
    } else if (p in CENTENAS) {
      current += CENTENAS[p]
    } else if (p in ESCALAS) {
      const escala = ESCALAS[p]
      if (escala === 100 && current === 0) current = 1
      if (escala >= 1000) {
        current = (current || 1) * escala
        total += current
        current = 0
      } else {
        current *= escala
      }
    } else {
      return null
    }
  }

  total += current
  return total > 0 ? total : null
}

interface Ficha {
  texto: string
  inicio: number
  fin: number
}

/** Palabras del texto con su posicion, para poder recortar despues. */
function fichas(texto: string): Ficha[] {
  const salida: Ficha[] = []
  const re = /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    salida.push({ texto: m[0], inicio: m.index, fin: m.index + m[0].length })
  }
  return salida
}

export interface MontoEnPalabras {
  soles: number
  /** Donde empieza el numero dentro del texto original. */
  inicio: number
  /** Donde acaba, incluyendo el «soles» si venia pegado. */
  fin: number
}

/**
 * Busca el importe dicho en palabras dentro de una frase cualquiera.
 *
 * Se queda con el tramo de valor mas alto. Y se le exige que lo diga en soles
 * o que la cifra tenga cuerpo: sin eso, «un millar de volantes» valdria S/1 y
 * «una cartulina» seria otro movimiento de un sol.
 */
export function buscarMontoEnPalabras(texto: string): MontoEnPalabras | null {
  const lista = fichas(texto)
  let mejor: MontoEnPalabras | null = null
  let i = 0

  while (i < lista.length) {
    if (valorPalabraNumero(lista[i].texto) === null) {
      i++
      continue
    }

    let j = i
    while (j < lista.length) {
      if (valorPalabraNumero(lista[j].texto) !== null) {
        j++
        continue
      }
      // «treinta Y cinco»: la conjuncion solo sigue el tramo si detras viene
      // otro numero; si no, «cinco y cartulina» se comeria la «y».
      const siguiente = lista[j + 1]
      if (
        sinTildes(lista[j].texto) === 'y' &&
        siguiente &&
        valorPalabraNumero(siguiente.texto) !== null
      ) {
        j += 2
        continue
      }
      break
    }

    const tramo = lista.slice(i, j)
    const soles = sumarTramo(tramo.map((f) => f.texto))
    const cola = lista[j]
    const enSoles = cola ? /^sol(?:es)?$/.test(sinTildes(cola.texto)) : false

    if (soles !== null && (enSoles || soles >= 20) && (mejor === null || soles > mejor.soles)) {
      mejor = {
        soles,
        inicio: tramo[0].inicio,
        fin: enSoles && cola ? cola.fin : tramo[tramo.length - 1].fin,
      }
    }

    i = Math.max(j, i + 1)
  }

  return mejor
}

/** Solo el importe, para quien no necesita saber donde estaba. */
export function montoEnPalabrasSoles(texto: string): number | null {
  return buscarMontoEnPalabras(texto)?.soles ?? null
}
