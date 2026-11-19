import { DIAS_SIN_RESPUESTA_DE_COTIZACION, diasEntreDias, urgenciaDeFecha, type TarjetaDePendiente, type UrgenciaDeMiDia } from '@capaz/shared';
import { codigoDeCotizacion } from './cotizacion.js';

// «Mi día» de cotizaciones: puro. Una cotización emitida o enviada sin respuesta hace 3 días o más, o cerca de vencer
// (o ya vencida), pide un seguimiento.

export type CotizacionSinRespuesta = {
  id: string;
  numero: number | null;
  anio: number | null;
  version: number;
  estado: 'emitida' | 'enviada';
  titulo: string;
  validaHasta: string | null;
  totalCentimos: number | null;
  /** Día local desde el que espera respuesta (cuando se emitió o se marcó enviada). */
  desde: string;
  clienteId: string | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
};

/** Cuántos días antes de `validaHasta` se avisa. */
export const DIAS_PARA_VENCER = 3;
const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

export function tarjetasDeCotizaciones(cotizaciones: readonly CotizacionSinRespuesta[], hoy: string): TarjetaDePendiente[] {
  return cotizaciones.flatMap((c): TarjetaDePendiente[] => {
    const sinRespuesta = Math.max(0, diasEntreDias(c.desde, hoy));
    const paraVencer = c.validaHasta === null ? null : diasEntreDias(hoy, c.validaHasta);
    const cercaDeVencer = paraVencer !== null && paraVencer <= DIAS_PARA_VENCER;
    if (sinRespuesta < DIAS_SIN_RESPUESTA_DE_COTIZACION && !cercaDeVencer) return [];
    const codigo = codigoDeCotizacion(c.numero, c.anio, c.version);
    const nombre = c.clienteNombre ?? 'Sin cliente';
    const urgencia: UrgenciaDeMiDia = c.validaHasta !== null && cercaDeVencer ? (paraVencer! <= 0 ? urgenciaDeFecha(c.validaHasta, hoy) : 'pronto') : 'pronto';
    const vence = paraVencer === null ? '' : paraVencer < 0 ? `Venció hace ${dias(-paraVencer)}` : paraVencer === 0 ? 'Vence hoy' : cercaDeVencer ? `Vence en ${dias(paraVencer)}` : '';
    const quien = c.estado === 'enviada' ? 'Enviada' : 'Emitida';
    const espera = sinRespuesta === 0 ? `${quien} hoy` : `${quien} hace ${dias(sinRespuesta)}, sin respuesta`;
    return [
      {
        clave: `cotizacion:${c.id}`,
        grupo: 'seguimiento',
        urgencia,
        titulo: `${codigo} · ${nombre}`,
        detalle: [vence, espera, c.titulo].filter(Boolean).join(' · '),
        fecha: c.validaHasta ?? c.desde,
        montoCentimos: c.totalCentimos,
        cliente: c.clienteId && c.clienteNombre ? { id: c.clienteId, nombre: c.clienteNombre, telefono: c.clienteTelefono } : null,
        entidad: { tipo: 'cotizacion', id: c.id, codigo },
        acciones: c.estado === 'emitida' ? [{ etiqueta: 'Ya la envié', herramienta: 'cotizacion_marcar_enviada', args: { id: c.id } }] : [],
        mensaje: null,
        cobro: null,
      },
    ];
  });
}
