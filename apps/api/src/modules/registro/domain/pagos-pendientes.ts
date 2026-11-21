import { diasEntreDias, urgenciaDeFecha, type TarjetaDePendiente } from '@capaz/shared';
import { codigoDeDeuda } from './codigos.js';

// Pagos por vencer en «Mi día»: puro. De las deudas por pagar con vencimiento cercano arma una tarjeta por deuda.

/** Hasta cuántos días antes del vencimiento aparece el aviso. */
export const DIAS_DE_AVISO_DE_PAGO = 3;

export type DeudaPorPagar = {
  id: string;
  anio: number;
  numero: number;
  proveedorId: string;
  proveedorNombre: string;
  concepto: string;
  saldoCentimos: number;
  venceEn: string;
};

const dias = (n: number) => `${n} ${n === 1 ? 'día' : 'días'}`;

function cuandoVence(venceEn: string, hoy: string): string {
  const d = diasEntreDias(hoy, venceEn);
  if (d < 0) return `venció hace ${dias(-d)}`;
  if (d === 0) return 'vence hoy';
  return d === 1 ? 'vence mañana' : `vence en ${dias(d)}`;
}

export function tarjetaDePago(p: DeudaPorPagar, hoy: string): TarjetaDePendiente {
  return {
    clave: `pagar:${p.id}`,
    grupo: 'seguimiento',
    urgencia: urgenciaDeFecha(p.venceEn, hoy),
    titulo: `Pagar a ${p.proveedorNombre}`,
    detalle: `${p.concepto} · ${cuandoVence(p.venceEn, hoy)}`,
    fecha: p.venceEn,
    montoCentimos: p.saldoCentimos,
    cliente: null,
    entidad: { tipo: 'deuda', id: p.id, codigo: codigoDeDeuda('por_pagar', p.anio, p.numero) },
    acciones: [],
    mensaje: null,
    cobro: null,
  };
}

/** Las que vencen dentro del plazo de aviso (o ya vencieron) y aún tienen saldo. */
export const tarjetasDePagos = (pagos: readonly DeudaPorPagar[], hoy: string): TarjetaDePendiente[] =>
  pagos.filter((p) => p.saldoCentimos > 0 && diasEntreDias(hoy, p.venceEn) <= DIAS_DE_AVISO_DE_PAGO).map((p) => tarjetaDePago(p, hoy));
