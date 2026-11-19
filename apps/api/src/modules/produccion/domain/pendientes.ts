import { diasEntreDias, formatearSoles, sumarDias, urgenciaDeFecha, type EstadoDeOrdenDeProduccion, type TarjetaDePendiente } from '@capaz/shared';
import { codigoDeOrden, estaAtrasada, saldoDe } from './orden.js';

// «Mi día» de producción: puro. Las órdenes de trabajo vivas que vencen hoy o mañana o ya están atrasadas (regla
// `estaAtrasada`), con la pregunta «¿ya está listo?» o «¿ya se entregó?» y si el trabajo ya está pagado.

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
  listo: '¿ya se entregó?',
};

function cuando(entregaEl: string, hoy: string): string {
  const d = diasEntreDias(hoy, entregaEl);
  if (d < 0) return `Atrasada ${-d} ${d === -1 ? 'día' : 'días'}`;
  return d === 0 ? 'Vence hoy' : 'Vence mañana';
}

export function tarjetasDeOrdenes(ordenes: readonly OrdenEnCurso[], hoy: string): TarjetaDePendiente[] {
  const limite = sumarDias(hoy, 1);
  return ordenes.flatMap((o): TarjetaDePendiente[] => {
    if (o.entregaEl === null || o.entregaEl > limite) return [];
    const codigo = codigoDeOrden(o.anio, o.numero);
    const saldo = saldoDe(o.totalCentimos, o.adelantoCentimos);
    const pagado = saldo <= 0;
    const entregado = { etiqueta: 'Ya se entregó', herramienta: 'produccion_orden_estado', args: { id: o.id, estado: 'entregado' } };
    const pregunta = o.estado === 'listo' && pagado ? 'Pagado: ¿ya se entregó?' : PREGUNTA[o.estado];
    return [
      {
        clave: `orden_trabajo:${o.id}:entrega`,
        grupo: 'entrega',
        urgencia: estaAtrasada(o.estado, o.entregaEl, hoy) ? 'atrasado' : urgenciaDeFecha(o.entregaEl, hoy),
        titulo: `${codigo} · ${o.clienteNombre}`,
        detalle: `${cuando(o.entregaEl, hoy)} · ${pregunta}${pagado ? (o.estado === 'listo' ? '' : ' · Pagado') : ` · Debe ${formatearSoles(saldo)}`}`,
        fecha: o.entregaEl,
        montoCentimos: o.totalCentimos,
        cliente: { id: o.clienteId, nombre: o.clienteNombre, telefono: o.clienteTelefono },
        entidad: { tipo: 'orden_trabajo', id: o.id, codigo },
        acciones: o.estado === 'listo' ? [entregado] : [{ etiqueta: 'Ya está listo', herramienta: 'produccion_orden_estado', args: { id: o.id, estado: 'listo' } }, entregado],
        mensaje: null,
        cobro: null,
      },
    ];
  });
}
