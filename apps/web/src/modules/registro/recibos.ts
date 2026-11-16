import type { DeudaConAbonosDto, DeudaDto, MovimientoDto } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import type { FilaDeTotal } from '../../shared/impresion/logica-impresion.ts';
import { ETIQUETA_DE_MEDIO, formatearDia } from './logica.ts';
import { montoEnLetras } from './monto-en-letras.ts';

// Lógica pura del recibo del abono y del estado de cuenta del cliente: sin React ni red, nada se guarda.

export const AVISO_DE_RECIBO = 'Constancia de pago, no es comprobante de pago electrónico';
export const AVISO_DE_ESTADO_DE_CUENTA = 'Estado de cuenta informativo, no es comprobante de pago electrónico';

// ---- Recibo del abono ----

export type ReciboDeAbono = {
  codigoDeuda: string;
  cliente: string;
  concepto: string;
  fecha: string;
  medio: string;
  codigoAbono: string;
  montoCentimos: number;
  montoEnLetras: string;
  saldoAnteriorCentimos: number;
  saldoPendienteCentimos: number;
};

/** Los abonos vivos se aplican en el orden en que se registraron (fecha, luego instante de alta, luego código). */
const porOrdenDeRegistro = (a: MovimientoDto, b: MovimientoDto): number =>
  a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn) || a.codigo.localeCompare(b.codigo);

export type ResultadoDeRecibo = { tipo: 'recibo'; recibo: ReciboDeAbono } | { tipo: 'anulado' } | { tipo: 'no-encontrado' } | { tipo: 'no-aplica' };

/** Arma el recibo de un abono de una cuenta por cobrar; distingue abono anulado, inexistente o de otra deuda. */
export function reciboDeAbono(d: DeudaConAbonosDto, abonoId: string): ResultadoDeRecibo {
  const abono = d.abonos.find((m) => m.id === abonoId);
  if (!abono) return { tipo: 'no-encontrado' };
  if (d.tipo !== 'por_cobrar') return { tipo: 'no-aplica' };
  if (abono.estado === 'anulado') return { tipo: 'anulado' };
  const previos = d.abonos.filter((m) => m.estado === 'activo' && porOrdenDeRegistro(m, abono) < 0);
  const saldoAnteriorCentimos = d.totalCentimos - previos.reduce((s, m) => s + m.montoCentimos, 0);
  return {
    tipo: 'recibo',
    recibo: {
      codigoDeuda: d.codigo,
      cliente: d.contactoNombre,
      concepto: d.concepto,
      fecha: abono.fecha,
      medio: ETIQUETA_DE_MEDIO[abono.medioDePago],
      codigoAbono: abono.codigo,
      montoCentimos: abono.montoCentimos,
      montoEnLetras: montoEnLetras(abono.montoCentimos),
      saldoAnteriorCentimos,
      saldoPendienteCentimos: saldoAnteriorCentimos - abono.montoCentimos,
    },
  };
}

export type ParDeRecibo = { etiqueta: string; valor: string };

export function paresDelRecibo(r: ReciboDeAbono): ParDeRecibo[] {
  return [
    { etiqueta: 'Cliente', valor: r.cliente },
    { etiqueta: 'Deuda', valor: r.codigoDeuda },
    { etiqueta: 'Concepto', valor: r.concepto },
    { etiqueta: 'Fecha del abono', valor: formatearDia(r.fecha) },
    { etiqueta: 'Medio de pago', valor: r.medio },
    { etiqueta: 'Abono', valor: r.codigoAbono },
  ];
}

export function totalesDelRecibo(r: ReciboDeAbono): FilaDeTotal[] {
  return [
    { etiqueta: 'Saldo anterior', valor: formatearSoles(r.saldoAnteriorCentimos) },
    { etiqueta: 'Monto abonado', valor: formatearSoles(r.montoCentimos), destacado: true },
    { etiqueta: 'Saldo pendiente', valor: formatearSoles(r.saldoPendienteCentimos), destacado: true },
  ];
}

// ---- Estado de cuenta ----

export type FilaDeEstadoDeCuenta = {
  codigo: string;
  concepto: string;
  fecha: string;
  vence: string;
  total: number;
  abonado: number;
  saldo: number;
  estado: string;
};

/** Hasta qué fecha (inclusive hacia atrás) se incluyen las pagadas: un año antes de hoy. */
export function inicioDelUltimoAnio(hoy: string): string {
  const [a, m, d] = hoy.split('-');
  return `${Number(a) - 1}-${m}-${d}`;
}

/** Deudas a mostrar: las abiertas siempre; las pagadas del último año solo si se piden. Orden: vencimiento y luego fecha. */
export function deudasDelEstado(abiertas: readonly DeudaDto[], pagadas: readonly DeudaDto[], conPagadas: boolean, hoy: string): DeudaDto[] {
  const desde = inicioDelUltimoAnio(hoy);
  const extra = conPagadas ? pagadas.filter((d) => d.estado === 'pagada' && d.fecha >= desde) : [];
  const clave = (d: DeudaDto) => d.venceEn ?? '9999-12-31';
  return [...abiertas.filter((d) => d.estado === 'pendiente' || d.estado === 'parcial'), ...extra].sort((a, b) => clave(a).localeCompare(clave(b)) || a.fecha.localeCompare(b.fecha));
}

export function filasDeEstadoDeCuenta(deudas: readonly DeudaDto[]): FilaDeEstadoDeCuenta[] {
  return deudas.map((d) => ({
    codigo: d.codigo,
    concepto: d.concepto,
    fecha: formatearDia(d.fecha),
    vence: d.venceEn ? formatearDia(d.venceEn) : '—',
    total: d.totalCentimos,
    abonado: d.abonadoCentimos,
    saldo: d.saldoCentimos,
    estado: d.vencida ? 'Vencida' : d.estado === 'pagada' ? 'Pagada' : d.estado === 'parcial' ? 'Parcial' : 'Pendiente',
  }));
}

export type TotalesDeEstado = { adeudadoCentimos: number; vencidoCentimos: number; cantidadVencidas: number };

/** Total adeudado = saldos de las abiertas; total vencido = saldos de las abiertas vencidas. */
export function totalesDeEstadoDeCuenta(deudas: readonly DeudaDto[]): TotalesDeEstado {
  const abiertas = deudas.filter((d) => d.estado === 'pendiente' || d.estado === 'parcial');
  const vencidas = abiertas.filter((d) => d.vencida);
  return {
    adeudadoCentimos: abiertas.reduce((s, d) => s + d.saldoCentimos, 0),
    vencidoCentimos: vencidas.reduce((s, d) => s + d.saldoCentimos, 0),
    cantidadVencidas: vencidas.length,
  };
}

export const filasDeTotalesDeEstado = (t: TotalesDeEstado): FilaDeTotal[] => [
  { etiqueta: 'Total vencido', valor: formatearSoles(t.vencidoCentimos) },
  { etiqueta: 'Total adeudado', valor: formatearSoles(t.adeudadoCentimos), destacado: true },
];

// ---- WhatsApp ----

/** Solo dígitos para `wa.me`; un celular peruano de 9 dígitos (empieza en 9) recibe el 51. Menos de 8 dígitos no sirve. */
export function telefonoParaWhatsApp(telefono: string | null | undefined): string | null {
  let d = (telefono ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('9')) d = `51${d}`;
  return d.length >= 8 && d.length <= 15 ? d : null;
}

export function mensajeDeEstadoDeCuenta(cliente: string, adeudadoCentimos: number, vencidoCentimos: number): string {
  const vencido = vencidoCentimos > 0 ? `, de los cuales ${formatearSoles(vencidoCentimos)} están vencidos` : '';
  return `Hola ${cliente}, tu saldo pendiente es de ${formatearSoles(adeudadoCentimos)}${vencido}. Te enviamos tu estado de cuenta.`;
}

export function enlaceDeWhatsApp(telefono: string | null | undefined, mensaje: string): string | null {
  const numero = telefonoParaWhatsApp(telefono);
  return numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : null;
}
