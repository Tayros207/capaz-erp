import { diasEntreDias, sumarDias, urgenciaDeFecha, type TarjetaDePendiente } from '@capaz/shared';
import { codigoDePedido } from './pedido.js';

// «Mi día» de pedidos: puro. De los pedidos en curso saca las entregas de hoy, de mañana y atrasadas (con la pregunta
// «¿ya está listo?» o «¿ya se entregó?») y los pedidos que siguen sin ningún adelanto desde que se confirmaron.

export type PedidoEnCurso = {
  id: string;
  serie: string | null;
  anio: number | null;
  numero: number | null;
  estado: 'confirmado' | 'en_proceso' | 'listo';
  entregaEl: string | null;
  totalCentimos: number;
  /** Día local en que se confirmó. */
  confirmadoDia: string | null;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
};

const DIAS_PARA_PONERSE_EN_PRONTO = 3;
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

function cuandoEntrega(entregaEl: string, hoy: string): string {
  const d = diasEntreDias(hoy, entregaEl);
  if (d < 0) return `Atrasado ${dias(-d)}`;
  return d === 0 ? 'Entrega hoy' : 'Entrega mañana';
}

const PREGUNTA: Record<PedidoEnCurso['estado'], string> = {
  confirmado: 'Confirmado: ¿ya está listo?',
  en_proceso: 'En proceso: ¿ya está listo?',
  listo: 'Listo: ¿ya se entregó?',
};

const accionesDe = (p: PedidoEnCurso) => {
  const entregado = { etiqueta: 'Ya se entregó', herramienta: 'pedido_cambiar_estado', args: { id: p.id, estado: 'entregado' } };
  return p.estado === 'listo' ? [entregado] : [{ etiqueta: 'Ya está listo', herramienta: 'pedido_cambiar_estado', args: { id: p.id, estado: 'listo' } }, entregado];
};

export function tarjetasDePedidos(pedidos: readonly PedidoEnCurso[], hoy: string): TarjetaDePendiente[] {
  const limite = sumarDias(hoy, 1);
  return pedidos.map((p): TarjetaDePendiente => {
    const codigo = codigoDePedido(p.serie, p.anio, p.numero);
    const base = {
      titulo: `${codigo} · ${p.clienteNombre}`,
      montoCentimos: p.totalCentimos,
      cliente: { id: p.clienteId, nombre: p.clienteNombre, telefono: p.clienteTelefono },
      entidad: { tipo: 'pedido' as const, id: p.id, codigo },
      mensaje: null,
      cobro: null,
    };
    if (p.entregaEl !== null && p.entregaEl <= limite) {
      return { ...base, clave: `pedido:${p.id}:entrega`, grupo: 'entrega', urgencia: urgenciaDeFecha(p.entregaEl, hoy), detalle: `${cuandoEntrega(p.entregaEl, hoy)} · ${PREGUNTA[p.estado]}`, fecha: p.entregaEl, acciones: accionesDe(p) };
    }
    const desde = p.confirmadoDia ?? hoy;
    const hace = Math.max(0, diasEntreDias(desde, hoy));
    return {
      ...base,
      clave: `pedido:${p.id}:adelanto`,
      grupo: 'adelanto',
      urgencia: hace >= DIAS_PARA_PONERSE_EN_PRONTO ? 'pronto' : 'info',
      detalle: `Sin ningún adelanto desde que se confirmó${hace === 0 ? ' hoy' : ` hace ${dias(hace)}`}`,
      fecha: p.entregaEl ?? desde,
      acciones: [],
    };
  });
}
