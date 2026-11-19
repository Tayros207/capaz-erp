import { diasEntreDias, formatearSoles, sumarDias, urgenciaDeFecha, type Anotacion, type EstadoDeOrdenDeProduccion, type TarjetaDePendiente } from '@capaz/shared';
import { codigoDeOrden, estaAtrasada, saldoDe } from './orden.js';

// «Mi día» de producción: puro. Las órdenes de trabajo vivas que vencen hoy o mañana o ya están atrasadas (regla
// `estaAtrasada`), con la pregunta «¿ya está listo?» o «¿ya se entregó?». Si el trabajo ya está pagado (según lo anotado en
// la orden) va como anotación: si Finanzas tiene la deuda de esa orden, su dato manda (lo decide el núcleo al componer).

export type OrdenEnCurso = {
  id: string;
  anio: number;
  numero: number;
  estado: Extract<EstadoDeOrdenDeProduccion, 'pendiente' | 'en_maquina' | 'listo'>;
  entregaEl: string | null;
  totalCentimos: number;
  adelantoCentimos: number;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
};

const PREGUNTA: Record<OrdenEnCurso['estado'], string> = {
  pendiente: 'Pendiente: ¿ya está listo?',
  en_maquina: 'En máquina: ¿ya está listo?',
  listo: 'Listo: ¿ya se entregó?',
};

function cuando(entregaEl: string, hoy: string): string {
  const d = diasEntreDias(hoy, entregaEl);
  if (d < 0) return `Atrasada ${-d} ${d === -1 ? 'día' : 'días'}`;
  return d === 0 ? 'Vence hoy' : 'Vence mañana';
}

type ConEntrega = OrdenEnCurso & { entregaEl: string };
/** Las que entran al panel: con entrega a más tardar mañana. */
const porEntregar = (ordenes: readonly OrdenEnCurso[], hoy: string): ConEntrega[] => {
  const limite = sumarDias(hoy, 1);
  return ordenes.filter((o): o is ConEntrega => o.entregaEl !== null && o.entregaEl <= limite);
};

export function tarjetasDeOrdenes(ordenes: readonly OrdenEnCurso[], hoy: string): TarjetaDePendiente[] {
  return porEntregar(ordenes, hoy).map((o): TarjetaDePendiente => {
    const { entregaEl } = o;
    const codigo = codigoDeOrden(o.anio, o.numero);
    const entregado = { etiqueta: 'Ya se entregó', herramienta: 'produccion_orden_estado', args: { id: o.id, estado: 'entregado' } };
    return {
      clave: `orden_trabajo:${o.id}:entrega`,
      grupo: 'entrega',
      urgencia: estaAtrasada(o.estado, entregaEl, hoy) ? 'atrasado' : urgenciaDeFecha(entregaEl, hoy),
      titulo: `${codigo} · ${o.clienteNombre}`,
      detalle: `${cuando(entregaEl, hoy)} · ${PREGUNTA[o.estado]}`,
      fecha: entregaEl,
      montoCentimos: o.totalCentimos,
      cliente: { id: o.clienteId, nombre: o.clienteNombre, telefono: o.clienteTelefono },
      entidad: { tipo: 'orden_trabajo', id: o.id, codigo },
      acciones: o.estado === 'listo' ? [entregado] : [{ etiqueta: 'Ya está listo', herramienta: 'produccion_orden_estado', args: { id: o.id, estado: 'listo' } }, entregado],
      mensaje: null,
      cobro: null,
    };
  });
}

/** «Pagado» o «Debe S/ X» de cada orden del panel, con lo anotado en la propia orden (total − adelanto). */
export function anotacionesDeOrdenes(ordenes: readonly OrdenEnCurso[], hoy: string): Anotacion[] {
  return porEntregar(ordenes, hoy).map((o): Anotacion => {
    const entidad = { tipo: 'orden_trabajo' as const, id: o.id };
    const saldo = saldoDe(o.totalCentimos, o.adelantoCentimos);
    return saldo <= 0
      ? { entidad, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true }
      : { entidad, texto: `Debe ${formatearSoles(saldo)}`, tono: 'aviso', pagado: false, conAdelanto: o.adelantoCentimos > 0 };
  });
}
