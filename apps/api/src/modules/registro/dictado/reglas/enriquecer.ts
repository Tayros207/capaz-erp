import type { Extraccion } from './extraccion.js'
import {
  inferirContacto,
  inferirTipo,
  montoACentimos,
  leerContratoConAdelanto,
} from './monto.js'
import { formatearNombreDeContacto, inferirDescripcion } from './descripcion.js'
import { esAbonoDeuda, contactoDeAbono } from './abono.js'
import { esProforma, contactoDeProforma } from './proforma.js'
import { inferirCategoria } from './categoria.js'
import { categoriaCoincideConTipo, esCategoriaValida } from './categorias-de-rubro.js'

export interface OpcionesEnriquecido {
  /**
   * El tipo que el dueño eligio TOCANDO el chip, no diciendolo.
   *
   * Manda sobre todo: sobre el modelo y sobre cualquier palabra de la frase.
   * Tocar «Egreso» es decir que se esta registrando, y eso no lo discute una
   * palabra suelta de la descripcion. Antes el chip solo anteponia su palabra
   * al texto y despues competia de igual a igual con el resto: «Egreso 200,
   * servicio de luz» acababa siendo un ingreso porque «servicio» empataba y el
   * desempate lo ganaba siempre ese lado.
   */
  modo?: 'ingreso' | 'egreso' | null
}

/** Parser local cuando el LLM falla o incompleta datos */
export function enriquecerExtraccion(
  text: string,
  partial: Extraccion,
  opciones: OpcionesEnriquecido = {}
): Extraccion {
  // Cotizacion: no es un movimiento ni un abono, no toca la contabilidad.
  // Va antes que el abono porque "cotiza el pago de..." menciona ambos.
  if (partial.es_proforma || esProforma(text)) {
    const contactoProforma =
      partial.contacto_nombre ?? contactoDeProforma(text) ?? inferirContacto(text)
    return {
      ...partial,
      es_proforma: true,
      es_abono: false,
      tipo: 'ingreso',
      monto_centimos: partial.monto_centimos ?? montoACentimos(text),
      adelanto_centimos: null,
      contacto_nombre: contactoProforma ? formatearNombreDeContacto(contactoProforma) : null,
      contacto_tipo: 'cliente',
      descripcion: partial.descripcion ?? inferirDescripcion(text) ?? text,
      categoria: null,
    }
  }

  // Abono a deuda existente: no es una transacción nueva
  const esAbono = partial.es_abono || esAbonoDeuda(text)
  if (esAbono) {
    const contactoAbono =
      partial.contacto_nombre ?? contactoDeAbono(text) ?? inferirContacto(text)
    return {
      ...partial,
      es_abono: true,
      monto_centimos: partial.monto_centimos ?? montoACentimos(text),
      adelanto_centimos: null,
      contacto_nombre: contactoAbono ? formatearNombreDeContacto(contactoAbono) : null,
      descripcion: partial.descripcion ?? text,
    }
  }

  const contrato = leerContratoConAdelanto(text)

  // EL MODELO MANDA; el lector local solo rellena lo que falte.
  //
  // Antes habia una condicion —«parece un contrato»— con la que el lector de
  // regex SUSTITUIA el monto y el adelanto que habia dado el modelo. Y saltaba
  // justo en el caso mas delicado: dos cifras juntas, donde confundir el total
  // con lo ya pagado descuadra la deuda del cliente. Ahi decidia la expresion
  // regular y la respuesta del modelo se tiraba.
  const monto = partial.monto_centimos ?? contrato?.monto_centimos ?? montoACentimos(text)
  const adelanto = partial.adelanto_centimos ?? contrato?.adelanto_centimos ?? null

  // El chip primero: es lo unico que el dueño dijo con el dedo y a proposito.
  let tipo = opciones.modo ?? partial.tipo ?? inferirTipo(text)
  if (!tipo && contrato) tipo = 'ingreso'

  const contactoRaw = partial.contacto_nombre ?? inferirContacto(text)
  const contacto = contactoRaw ? formatearNombreDeContacto(contactoRaw) : null

  // La descripcion del modelo va PRIMERO. Antes ganaba la heuristica local y la
  // del modelo solo se miraba cuando aquella no encontraba nada: en las frases
  // donde el modelo acertaba —que son las desordenadas, justo las que la
  // heuristica no sabe cortar— su respuesta se tiraba a la basura.
  //
  // Se le sigue exigiendo que sea CORTA: si devuelve casi la frase entera no
  // ha resumido nada y no aporta sobre el texto crudo.
  const delModelo = partial.descripcion?.trim() ?? ''
  const modeloResumio = delModelo.length > 0 && delModelo.length < text.length * 0.7
  const descripcion = (modeloResumio ? delModelo : null) ?? inferirDescripcion(text) ?? text

  return {
    ...partial,
    monto_centimos: monto,
    adelanto_centimos: adelanto,
    tipo,
    contacto_nombre: contacto,
    contacto_tipo: partial.contacto_tipo ?? (tipo === 'egreso' ? 'proveedor' : 'cliente'),
    descripcion,
    categoria: resolverCategoria(text, tipo, partial.categoria, contacto),
  }
}

/**
 * Elige la categoria contable. El tipo debe estar resuelto: una categoria de
 * egreso en un ingreso descuadra los reportes, asi que se descarta cualquier
 * propuesta que no corresponda al lado del movimiento.
 *
 * Devuelve null sin dudarlo cuando no hay señal: sin clasificar es un estado
 * valido y recuperable desde la pantalla de clasificacion, mientras que una
 * categoria equivocada ensucia los reportes en silencio.
 */
function resolverCategoria(
  text: string,
  tipo: 'ingreso' | 'egreso' | null,
  propuesta: string | null | undefined,
  contacto: string | null
): Extraccion['categoria'] {
  if (!tipo) return null

  if (esCategoriaValida(propuesta) && categoriaCoincideConTipo(propuesta, tipo)) {
    return propuesta
  }

  // El nombre del contacto suma señal: "Comercial Pacheco" en un egreso de
  // cartulina ayuda tanto como la descripcion.
  return inferirCategoria(contacto ? `${text} ${contacto}` : text, tipo)
}
