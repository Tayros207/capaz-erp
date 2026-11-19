import { ESTADOS_DE_PEDIDO_PARA_GUIA, type ArgsDe, type EstadoDeGuia, type EstadoDePedido, type LineaDeGuiaDeEntrada, type ModalidadDeTraslado, type MotivoDeTraslado } from '@capaz/shared';
import { NOMBRE_DE_ESTADO } from './estados.js';
import type { Comprobacion } from './pedido.js';

// Reglas de las guías de remisión (control interno): sin base de datos, solo lo que se decide con los datos a la mano.

export const CLAVE_DE_CORRELATIVO_DE_GUIA = 'ordenes.guia';
/** Sin reinicio anual: el correlativo de las guías es continuo por empresa. */
export const ANIO_DEL_CORRELATIVO_DE_GUIA = 0;

export const codigoDeGuia = (serie: string, numero: number): string => `${serie}-${String(numero).padStart(6, '0')}`;

/** 2500 → '2.5', 1000 → '1'. */
export const textoDeCantidad = (milesimas: number): string => String(milesimas / 1000);

/** 'RUC 20123456789'; sin número, `null`. */
export function documentoDeCliente(tipo: string | null, numero: string | null): string | null {
  if (!numero) return null;
  return tipo ? `${tipo.toUpperCase()} ${numero}` : numero;
}

export type LineaDePedidoParaGuia = {
  id: string;
  pedidoId: string;
  pedidoCodigo: string;
  posicion: number;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
};
export type LineaDeGuiaPreparada = {
  posicion: number;
  pedidoId: string | null;
  pedidoLineaId: string | null;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
};

export const pendienteDe = (pedida: number, enviada: number): number => Math.max(0, pedida - enviada);

type Preparacion = { ok: true; lineas: LineaDeGuiaPreparada[] } | { ok: false; codigo: 'argumentos_invalidos' | 'conflicto'; motivo: string };

function lineaDePedido(
  n: number,
  entrada: Extract<LineaDeGuiaDeEntrada, { tipo: 'pedido' }>,
  origen: LineaDePedidoParaGuia | undefined,
  yaEnviado: number,
  posicion: number,
): { ok: true; linea: LineaDeGuiaPreparada } | { ok: false; codigo: 'argumentos_invalidos' | 'conflicto'; motivo: string } {
  if (!origen) return { ok: false, codigo: 'argumentos_invalidos', motivo: `Línea ${n}: esa línea de pedido no existe.` };
  const pendiente = pendienteDe(origen.cantidadMilesimas, yaEnviado);
  const nombre = `${origen.descripcion}, ${origen.pedidoCodigo}`;
  if (pendiente === 0) return { ok: false, codigo: 'conflicto', motivo: `Línea ${n} (${nombre}): ya se envió completa.` };
  if (entrada.cantidadMilesimas > pendiente) {
    const quedan = `${textoDeCantidad(pendiente)} ${origen.unidad}`;
    return { ok: false, codigo: 'conflicto', motivo: `Línea ${n} (${nombre}): quedan ${quedan} por enviar y pides ${textoDeCantidad(entrada.cantidadMilesimas)}.` };
  }
  return {
    ok: true,
    linea: {
      posicion,
      pedidoId: origen.pedidoId,
      pedidoLineaId: origen.id,
      productoId: origen.productoId,
      descripcion: origen.descripcion,
      unidad: origen.unidad,
      cantidadMilesimas: entrada.cantidadMilesimas,
    },
  };
}

/** Convierte las líneas pedidas en líneas de guía, con el tope de lo pendiente por cada línea de pedido. `n` en los mensajes es índice + 1. */
export function prepararLineasDeGuia(
  entradas: readonly LineaDeGuiaDeEntrada[],
  lineas: ReadonlyMap<string, LineaDePedidoParaGuia>,
  enviadas: ReadonlyMap<string, number>,
): Preparacion {
  const vistas = new Set<string>();
  const resultado: LineaDeGuiaPreparada[] = [];
  for (const [i, e] of entradas.entries()) {
    if (e.tipo === 'libre') {
      resultado.push({ posicion: i, pedidoId: null, pedidoLineaId: null, productoId: null, descripcion: e.descripcion, unidad: e.unidad || 'unidad', cantidadMilesimas: e.cantidadMilesimas });
      continue;
    }
    if (vistas.has(e.pedidoLineaId)) return { ok: false, codigo: 'argumentos_invalidos', motivo: `Línea ${i + 1}: esa línea de pedido ya está en la guía.` };
    vistas.add(e.pedidoLineaId);
    const r = lineaDePedido(i + 1, e, lineas.get(e.pedidoLineaId), enviadas.get(e.pedidoLineaId) ?? 0, i);
    if (!r.ok) return r;
    resultado.push(r.linea);
  }
  return { ok: true, lineas: resultado };
}

export function comprobarPedidoParaGuia(p: { estado: EstadoDePedido; clienteId: string; codigo: string }, clienteId: string): Comprobacion {
  if (!(ESTADOS_DE_PEDIDO_PARA_GUIA as readonly string[]).includes(p.estado)) {
    return { ok: false, motivo: `El pedido ${p.codigo} está «${NOMBRE_DE_ESTADO[p.estado]}»: la guía se emite con el pedido listo o entregado.` };
  }
  if (p.clienteId !== clienteId) return { ok: false, motivo: `El pedido ${p.codigo} es de otro cliente: una guía lleva pedidos de un solo cliente.` };
  return { ok: true };
}

export function comprobarAnulacion(estado: EstadoDeGuia): Comprobacion {
  return estado === 'anulada' ? { ok: false, motivo: 'La guía ya estaba anulada.' } : { ok: true };
}

export type DatosDeTraslado = {
  fechaTraslado: string;
  destinatarioDocumento: string | null;
  puntoPartida: string;
  puntoLlegada: string;
  motivo: MotivoDeTraslado;
  motivoDetalle: string | null;
  modalidad: ModalidadDeTraslado;
  transportista: string | null;
  conductor: string | null;
  licencia: string | null;
  placa: string | null;
  bultos: string | null;
  observaciones: string | null;
};

const limpio = (v: string | null | undefined): string | null => v?.trim() || null;

/** Recorta espacios; vacío pasa a `null`; sin transportista si es privado; sin detalle si el motivo no es «otro». */
export function normalizarTraslado(a: ArgsDe<'guia_emitir'>): DatosDeTraslado {
  return {
    fechaTraslado: a.fechaTraslado,
    destinatarioDocumento: limpio(a.destinatarioDocumento),
    puntoPartida: a.puntoPartida.trim(),
    puntoLlegada: a.puntoLlegada.trim(),
    motivo: a.motivo,
    motivoDetalle: a.motivo === 'otro' ? limpio(a.motivoDetalle) : null,
    modalidad: a.modalidad,
    transportista: a.modalidad === 'publico' ? limpio(a.transportista) : null,
    conductor: limpio(a.conductor),
    licencia: limpio(a.licencia),
    placa: limpio(a.placa),
    bultos: limpio(a.bultos),
    observaciones: limpio(a.observaciones),
  };
}

/** El texto del rechazo si el pedido tiene guías emitidas; `null` si no tiene. */
export function motivoDeGuiasEmitidas(codigos: readonly string[]): string | null {
  if (codigos.length === 0) return null;
  if (codigos.length === 1) return `El pedido tiene la guía ${codigos[0]} emitida: anúlala antes de cancelar el pedido.`;
  return `El pedido tiene las guías ${codigos.join(', ')} emitidas: anúlalas antes de cancelar el pedido.`;
}
