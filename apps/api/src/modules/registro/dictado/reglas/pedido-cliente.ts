// Porte adaptado de SF (features/ordenes/lib/dictado-orden.ts). Cambios respecto a SF:
//  - esPedidoDictado reemplaza a esOrdenDictada: también acepta «pedido», no actúa en modo egreso, excluye «orden de compra»
//    y no se dispara si un verbo de cobro precede a «orden» («cobré 200 de la orden de Juan»).
//  - extraerClienteDePedido (SF extraerContactoOrden): CORTE también corta en «: ; .», los patrones 1 y 2 aceptan «pedido»
//    y NO_ES_NOMBRE suma «pedido|orden».
//  - quitarMenciones: la palabra clave admite «nota de pedido» y «pedido(s)»; usa MULETILLA_PEDIDO.
import { sinTildes } from './pedido-texto.js';
import { capitalizarNombre, recortarNombre } from './vocabulario-imprenta.js';

/**
 * Cómo ABRE la gente cuando habla en vez de dictar con formato: «sabes qué...», «oye...», «hazme el favor de...».
 * Las tildes van escritas a mano porque el \w de JavaScript es ASCII y se detiene justo antes de ellas.
 */
export const MULETILLA_PEDIDO =
  /^[\s,;.]*(?:ya\s+pues|ya\s+pe|sabes|oye|oe|mira|mmm+|eh+|a\s+ver|h[aá]zme(?:\s+el\s+favor(?:\s+de)?)?|por\s+favor|an[oó]t[a-záéíóúñ]*|ap[uú]nt[a-záéíóúñ]*|reg[ií]str[a-záéíóúñ]*|cre[ae][a-záéíóúñ]*|gener[ae][a-záéíóúñ]*|agreg[ae][a-záéíóúñ]*|a[ñn]ad[ae][a-záéíóúñ]*|hacer|nuev[oa]s?|(?:me\s+|nos\s+|le\s+|les\s+)?(?:encarg|pidi|solicit)[a-záéíóúñ]*|quiero|quisiera|necesito|dime|qu[eé])(?![a-záéíóúñ])[\s,;.:-]*/i;

const NO_ES_NOMBRE =
  /^(?:un|una|unos|unas|el|la|los|las|mi|su|de|del|al|a|y|o|en|con|por|para|que|es|son|soles?|trabajo|nueva|nuevo|pedido|orden)$/i;

const VERBO_DE_COBRO = /\b(?:cobr\w*|pag\w*|abon\w*|amortiz\w*|deposit\w*|ingreso|egreso)\b/;

/** ¿La frase pide un PEDIDO? Con «orden»/«OT» (sin verbo de cobro delante) o empezando por «pedido». */
export function esPedidoDictado(texto: string, modo?: 'ingreso' | 'egreso'): boolean {
  if (modo === 'egreso') return false;
  const plano = sinTildes(texto);
  if (/\b(proforma\w*|cotiza\w*|cotizacion\w*|presupuest\w*)\b/.test(plano) || /\borden(?:es)?\s+de\s+compra\b/.test(plano)) return false;
  const m = /\b(orden(?:es)?)\b|^\s*ot\b/.exec(plano);
  if (m) return !VERBO_DE_COBRO.test(plano.slice(0, m.index));
  let resto = plano;
  let previo = '';
  while (previo !== resto) {
    previo = resto;
    resto = resto.replace(MULETILLA_PEDIDO, '');
  }
  return /^(?:(?:un|una|el|la|mi)\s+)*(?:nota\s+de\s+)?pedidos?\b/.test(resto);
}

/** Nombre del cliente en una frase de pedido: «Pedido para Cristina, …». */
export function extraerClienteDePedido(texto: string): string | null {
  const NOMBRE = '[A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ\\s]{0,40}?';
  // La coma corta primero (también «: ; .»). Las etiquetas del formulario y «y adelanto» cortan también.
  const CORTE =
    '(?=\\s*[,:;.]|\\s+y\\s+(?:adelanto|anticipo|a\\s+cuenta)\\b|\\s+(?:por|de|en|con|para|trabajo|valor|precio|adelanto|anticipo|entrega|cuenta)\\b|\\s+\\d|\\s*$)';
  const plano = sinTildes(texto);
  const patrones = [
    // «Pedido (de trabajo) para/a Cristina, …» — la forma con preposición.
    new RegExp(
      `\\b(?:orden(?:es)?|ot|pedido)\\b(?:\\s+de\\s+trabajo)?\\s+(?:nueva\\s+|nuevo\\s+)?(?:para|a|de)\\s+(?:el\\s+|la\\s+)?(?:cliente\\s+|senor(?:a)?\\s+|don\\s+|dona\\s+)?(${NOMBRE})${CORTE}`,
      'i',
    ),
    // Sin preposición: «Pedido Cristina, 500 tarjetas…».
    new RegExp(
      `\\b(?:orden(?:es)?|ot|pedido)\\b(?:\\s+de\\s+trabajo)?\\s+(?:el\\s+|la\\s+)?(?:cliente\\s+|senor(?:a)?\\s+|don\\s+|dona\\s+)?(${NOMBRE})${CORTE}`,
      'i',
    ),
    // «… cliente Cristina …» en cualquier posición.
    new RegExp(`\\bcliente\\s+(${NOMBRE})${CORTE}`, 'i'),
  ];
  for (const patron of patrones) {
    const m = plano.match(patron);
    if (!m || m.index === undefined) continue;
    // Se recorta del ORIGINAL para no devolver «Maria» por «María»: quitar el diacrítico no cambia el largo.
    const inicio = plano.indexOf(m[1]!, m.index);
    const capturado = (inicio >= 0 ? texto.slice(inicio, inicio + m[1]!.length) : m[1]!).trim();
    // Dictando sin comas el nombre se comía lo que venía detrás: se corta en la primera palabra que no puede ser nombre.
    const nombre = recortarNombre(capturado);
    if (!nombre) continue;
    if (NO_ES_NOMBRE.test(nombre) || /^\d/.test(nombre)) continue;
    return capitalizarNombre(nombre);
  }
  return null;
}

/** Deja solo lo que describe el TRABAJO: quita la palabra clave y la mención del cliente, estén donde estén. */
export function quitarMenciones(texto: string, cliente: string | null): string {
  let resto = texto;
  if (cliente) {
    const plano = sinTildes(resto);
    const pos = plano.indexOf(sinTildes(cliente));
    if (pos >= 0) {
      // Se lleva también el «del cliente» / «para la señora» que lo presenta.
      const antes = resto
        .slice(0, pos)
        .replace(/[\s,;]*(?:\b(?:para|a|de|del)\b\s*)?(?:\b(?:el|la)\b\s*)?(?:\b(?:cliente|se[nñ]ora?|don|do[nñ]a)\b\s*)?$/i, ' ');
      resto = `${antes} ${resto.slice(pos + cliente.length)}`;
    }
  }
  // También el artículo de delante y el «nueva», estén donde estén.
  resto = resto.replace(
    /\b(?:un[ao]?\s+|la\s+|el\s+)?(?:nueva\s+|nuevo\s+)?(?:nota\s+de\s+pedido|pedidos?|orden(?:es)?|ot)\b(?:\s+de\s+trabajo)?(?:\s+nuev[ao])?/i,
    ' ',
  );
  // Las muletillas, en bucle porque vienen encadenadas.
  let previo = '';
  while (previo !== resto) {
    previo = resto;
    resto = resto.replace(MULETILLA_PEDIDO, '');
  }
  return resto.replace(/\s{2,}/g, ' ').replace(/^[\s,;.:]+|[\s,;.:]+$/g, '').trim();
}
