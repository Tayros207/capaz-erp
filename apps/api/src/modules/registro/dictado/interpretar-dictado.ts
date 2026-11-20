// REGLA NUEVA (no portada de Tairos.RC): la única puerta de las reglas de dictado. Pura: lee y propone, no ejecuta nada.
import { categoriaDeCapaz } from './categoria-de-capaz.js';
import { tipoDeDeudaDictada } from './deuda.js';
import { fechaDictada } from './fecha.js';
import { esCategoriaValida, type Categoria } from './reglas/categorias-de-rubro.js';
import { enriquecerExtraccion } from './reglas/enriquecer.js';
import type { Extraccion } from './reglas/extraccion.js';
import { inferirTipo } from './reglas/monto.js';
import { esPedidoDictado, interpretarPedidoDictado, type PedidoDictado } from './reglas/pedido.js';
import { pistaDeDictadoIncompleto } from './reglas/pista.js';

export type IntencionDeDictado = 'movimiento' | 'abono' | 'deuda' | 'deuda_con_adelanto' | 'fuera_de_alcance' | 'incompleto' | 'pedido';

export type Dictado = {
  intencion: IntencionDeDictado;
  tipo: 'ingreso' | 'egreso' | null;
  montoCentimos: number | null;
  adelantoCentimos: number | null;
  /** Como se dictó, ya con mayúsculas de nombre (formatearNombreDeContacto). */
  contactoNombre: string | null;
  descripcion: string | null;
  categoriaDeRubro: Categoria | null;
  /** Nombre de una de las 8 categorías por defecto de Capaz, o null. */
  categoriaDeCapaz: string | null;
  tipoDeDeuda: 'por_cobrar' | 'por_pagar' | null;
  /** AAAA-MM-DD solo si se dictó «ayer» o «anteayer». */
  fecha: string | null;
  /** Solo con intencion «pedido»: lo entendido de «Pedido para Rosa, 500 tarjetas a 0.365…». */
  pedido: PedidoDictado | null;
  faltan: string[];
  pista: string | null;
};

const VACIA: Extraccion = {
  tipo: null,
  monto_centimos: null,
  adelanto_centimos: null,
  contacto_nombre: null,
  contacto_tipo: null,
  descripcion: null,
  categoria: null,
  es_abono: false,
  es_consulta: false,
  es_proforma: false,
  comando: null,
};

type Opciones = { modo?: 'ingreso' | 'egreso'; hoy: string; extraccion?: Extraccion | null };

function resultado(e: Extraccion, texto: string, hoy: string, parcial: Partial<Dictado> & Pick<Dictado, 'intencion'>): Dictado {
  const rubro: Categoria | null = esCategoriaValida(e.categoria) ? e.categoria : null;
  const conFecha = parcial.intencion === 'movimiento' || parcial.intencion === 'abono';
  return {
    tipo: null,
    montoCentimos: e.monto_centimos,
    adelantoCentimos: null,
    contactoNombre: e.contacto_nombre,
    descripcion: e.descripcion,
    categoriaDeRubro: rubro,
    categoriaDeCapaz: rubro ? categoriaDeCapaz(rubro) : null,
    tipoDeDeuda: null,
    fecha: conFecha ? fechaDictada(texto, hoy) : null,
    pedido: null,
    faltan: [],
    pista: null,
    ...parcial,
  };
}

export const PISTA_DE_PEDIDO =
  'Dicta cada trabajo con su precio, por ejemplo: «Pedido para Rosa, 500 tarjetas a 0.365 y un millar de volantes a 240, adelanto 100, para el viernes».';

function dictadoDePedido(texto: string, hoy: string): Dictado {
  const pedido = interpretarPedidoDictado(texto, hoy);
  const sinLineas = pedido.lineas.length === 0;
  return {
    intencion: 'pedido',
    tipo: null,
    montoCentimos: null,
    adelantoCentimos: pedido.adelantoCentimos,
    contactoNombre: pedido.clienteNombre,
    descripcion: null,
    categoriaDeRubro: null,
    categoriaDeCapaz: null,
    tipoDeDeuda: null,
    fecha: null,
    pedido,
    faltan: sinLineas ? ['qué se pidió y su precio'] : [],
    pista: sinLineas ? PISTA_DE_PEDIDO : null,
  };
}

export function interpretarDictado(texto: string, opciones: Opciones): Dictado {
  // Un pedido se decide antes de enriquecer: «pedido»/«orden» no son un contrato ni una deuda.
  if (esPedidoDictado(texto, opciones.modo)) return dictadoDePedido(texto, opciones.hoy);
  const e = enriquecerExtraccion(texto, opciones.extraccion ?? VACIA, { modo: opciones.modo });
  const hoy = opciones.hoy;

  if (e.es_proforma) {
    return resultado(e, texto, hoy, {
      intencion: 'fuera_de_alcance',
      pista: 'Las proformas y cotizaciones no se dictan aquí: hazlas en Pedidos.',
    });
  }
  if (e.monto_centimos === null) {
    return resultado(e, texto, hoy, {
      intencion: 'incompleto',
      faltan: ['el monto'],
      pista: pistaDeDictadoIncompleto(texto),
    });
  }
  if (e.es_abono) {
    const egreso = (opciones.modo ?? inferirTipo(texto)) === 'egreso';
    return resultado(e, texto, hoy, {
      intencion: 'abono',
      tipo: egreso ? 'egreso' : 'ingreso',
      tipoDeDeuda: egreso ? 'por_pagar' : 'por_cobrar',
    });
  }
  if (e.adelanto_centimos !== null) {
    return resultado(e, texto, hoy, {
      intencion: 'deuda_con_adelanto',
      tipo: e.tipo,
      adelantoCentimos: e.adelanto_centimos,
      tipoDeDeuda: e.tipo === 'egreso' ? 'por_pagar' : 'por_cobrar',
    });
  }
  const deuda = tipoDeDeudaDictada(texto);
  if (deuda !== null) {
    return resultado(e, texto, hoy, { intencion: 'deuda', tipo: e.tipo, tipoDeDeuda: deuda });
  }
  if (e.tipo === null) {
    return resultado(e, texto, hoy, {
      intencion: 'incompleto',
      faltan: ['si entró o salió'],
      pista: 'Toca «Ingreso» o «Egreso» y vuelve a enviar.',
    });
  }
  return resultado(e, texto, hoy, { intencion: 'movimiento', tipo: e.tipo });
}
