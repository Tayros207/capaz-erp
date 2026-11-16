import { CANTIDADES_DE_REFERENCIA } from '../base/cantidades-de-referencia.js'
import { aTexto, CERO, DECIMALES_IMPORTE, dividir, esMayor, esMenor, multiplicar } from '../base/dinero.js'
import type {
  HallazgoDeReferencias,
  Punto,
  Referencias,
  ValidacionDeReferencias,
} from './tipos/precio-por-escala.js'

/** Las tres referencias con su cantidad, de menor a mayor. */
export function puntosDeReferencia(referencias: Referencias): [Punto, Punto, Punto] {
  const [c100, c1000, c5000] = CANTIDADES_DE_REFERENCIA
  return [
    { cantidad: c100, total: referencias.p100 },
    { cantidad: c1000, total: referencias.p1000 },
    { cantidad: c5000, total: referencias.p5000 },
  ]
}

function hallazgoDeTramo(a: Punto, b: Punto): { bloqueo?: HallazgoDeReferencias; aviso?: HallazgoDeReferencias } {
  // Invariante B: nadie paga menos pidiendo más (DEV-01).
  if (!esMayor(b.total, a.total)) {
    return {
      bloqueo: {
        codigo: 'total_no_crece',
        mensaje: `El total de ${b.cantidad} unidades (${b.total}) debe ser mayor que el de ${a.cantidad} (${a.total}): nadie paga menos por pedir más.`,
      },
    }
  }
  // Invariante A: el unitario baja con el volumen. b/a veces la cantidad, así que el total
  // debe crecer menos que b/a veces: 10 veces de 100 a 1.000 y 5 veces de 1.000 a 5.000.
  const veces = dividir(b.cantidad, a.cantidad)
  const tope = multiplicar(a.total, veces)
  if (!esMenor(b.total, tope)) {
    return {
      aviso: {
        codigo: 'unitario_no_baja',
        mensaje: `El unitario no baja de ${a.cantidad} a ${b.cantidad} unidades: el total de ${b.cantidad} (${b.total}) debería ser menor que ${aTexto(veces)} veces el de ${a.cantidad} (${aTexto(tope, DECIMALES_IMPORTE)}).`,
      },
    }
  }
  return {}
}

/**
 * Valida las referencias al cargarlas (corrige DEV-01): B bloquea y A avisa. Por tramo son
 * excluyentes (si el total no crece, el unitario baja seguro), así que cada uno da a lo sumo un
 * hallazgo. Con un total que no es positivo no se evalúa nada más.
 */
export function validarReferencias(referencias: Referencias): ValidacionDeReferencias {
  return validarPuntos(puntosDeReferencia(referencias))
}

/**
 * Lo mismo para cualquier lista de cantidades con su total, de menor a mayor cantidad (por ejemplo, solo las
 * dos que se le envían al cliente desde el cuadro por partes): cada par seguido se compara con B y con A.
 */
export function validarPuntos(puntos: readonly Punto[]): ValidacionDeReferencias {
  const noPositivos = puntos
    .filter((p) => !esMayor(p.total, CERO))
    .map((p): HallazgoDeReferencias => ({
      codigo: 'precio_no_positivo',
      mensaje: `El total de ${p.cantidad} unidades debe ser mayor que cero.`,
    }))
  if (noPositivos.length > 0) return { bloqueos: noPositivos, avisos: [] }

  const bloqueos: HallazgoDeReferencias[] = []
  const avisos: HallazgoDeReferencias[] = []
  for (const [i, b] of puntos.entries()) {
    if (i === 0) continue
    const { bloqueo, aviso } = hallazgoDeTramo(puntos[i - 1], b)
    if (bloqueo) bloqueos.push(bloqueo)
    if (aviso) avisos.push(aviso)
  }
  return { bloqueos, avisos }
}
