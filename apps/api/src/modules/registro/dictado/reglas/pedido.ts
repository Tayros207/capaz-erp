// Porte adaptado de SF (features/ordenes/lib/dictado-orden.ts:448-495, interpretarOrdenDictada). Cambios: el resultado es un
// PedidoDictado (líneas en milésimas, adelanto en céntimos); el adelanto acepta números en palabras y decimales; sin cliente,
// fecha ni líneas todo queda vacío. Puro: lee texto y propone, no ejecuta nada.
import { extraerClienteDePedido, quitarMenciones } from './pedido-cliente.js';
import { extraerFechaEntrega } from './pedido-fecha.js';
import { partirEnTrozos, trozoALinea, type LineaDictada } from './pedido-lineas.js';
import { numeroAlInicio, quitar, sinTildes } from './pedido-texto.js';

export { esPedidoDictado } from './pedido-cliente.js';
export type { LineaDictada, UnidadDictada } from './pedido-lineas.js';

export type PedidoDictado = {
  clienteNombre: string | null;
  lineas: LineaDictada[];
  adelantoCentimos: number | null;
  entregaEl: string | null;
};

// El `y` opcional del principio y el «con»/pronombre («CON adelanto de 100», «ME adelantó 100») se comen con la palabra clave.
const RE_CLAVE_ADELANTO = /[,;]?\s*(?:\b(?:y|e|con|me|nos)\s+)*\b(?:adelant\w*|anticip\w*|a\s+cuenta|dej[a-z]*)\s*(?:de\s+)?/i;

/** Saca el adelanto dictado («adelanto 100», «a cuenta cincuenta», «me dejó 150»). Sin número no toca nada. */
export function extraerAdelanto(texto: string): { centimos: number | null; resto: string } {
  // Sobre el texto SIN TILDES: «me adelantó 100» no casaba con `adelant\w*` porque \w es ASCII.
  const plano = sinTildes(texto);
  const m = RE_CLAVE_ADELANTO.exec(plano);
  if (!m) return { centimos: null, resto: texto };
  const tras = plano.slice(m.index + m[0].length);
  const n = numeroAlInicio(tras);
  if (!n) return { centimos: null, resto: texto };
  const soles = /^\s*(?:soles?)?/.exec(tras.slice(n.fin))![0].length;
  return { centimos: Math.round(n.milesimas / 10), resto: quitar(texto, m.index, m[0].length + n.fin + soles) };
}

/** Lee un pedido dictado. `hoy` (AAAA-MM-DD) entra como parámetro para que la función sea pura. */
export function interpretarPedidoDictado(texto: string, hoy: string): PedidoDictado {
  const cliente = extraerClienteDePedido(texto);
  const sinMenciones = quitarMenciones(texto, cliente);
  // El adelanto sale ANTES de partir en trabajos y la fecha también: ninguno es una línea.
  const { centimos, resto: sinAdelanto } = extraerAdelanto(sinMenciones);
  const { fecha, resto } = extraerFechaEntrega(sinAdelanto, hoy);
  const lineas = partirEnTrozos(resto)
    .map(trozoALinea)
    .filter((l): l is LineaDictada => l !== null);
  return { clienteNombre: cliente, lineas, adelantoCentimos: centimos, entregaEl: fecha || null };
}
