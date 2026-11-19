import { diasEntreDias, formatearSoles, type Anotacion, type TipoDeEntidadDeMiDia } from '@capaz/shared';

// «A quién cobrar» y anotaciones de Mi día: puro. Agrupa las deudas por cobrar vencidas por cliente, en tramos, y traduce
// el estado de las deudas que nacieron de un pedido o una orden de trabajo en una anotación para su tarjeta.

/** Una deuda por cobrar sin saldar: lo único que necesita este cálculo. */
export type DeudaPorCobrar = {
  contactoId: string;
  contactoNombre: string;
  contactoTelefono: string | null;
  saldoCentimos: number;
  fecha: string;
  venceEn: string | null;
};

/** Sin vencimiento escrito, a la deuda se la recuerda recién pasados 30 días desde su fecha (el crédito usual). */
export const PLAZO_SIN_VENCIMIENTO = 30;

/**
 * Días que lleva vencida, contados igual que en «Antigüedad de saldos» (`tramoDe`): desde el vencimiento o, si no lo tiene,
 * desde su fecha. Así los días y los tramos de «Mi día» coinciden con ese reporte. 0 o menos: vigente.
 */
export const diasVencida = (d: Pick<DeudaPorCobrar, 'fecha' | 'venceEn'>, hoy: string): number => diasEntreDias(d.venceEn ?? d.fecha, hoy);

/** ¿Ya toca recordarla? Con vencimiento, desde el día siguiente; sin él, pasado el plazo usual desde su fecha. */
export const tocaCobrar = (d: Pick<DeudaPorCobrar, 'fecha' | 'venceEn'>, hoy: string): boolean =>
  diasVencida(d, hoy) > (d.venceEn === null ? PLAZO_SIN_VENCIMIENTO : 0);

export type CobroDeCliente = {
  contactoId: string;
  contactoNombre: string;
  contactoTelefono: string | null;
  totalCentimos: number;
  tramo0a30Centimos: number;
  tramo31a60Centimos: number;
  tramo61masCentimos: number;
  diasMasAntiguo: number;
  deudas: number;
};

/** Tramos de lo vencido: 1-30, 31-60 y 61 o más días (los campos se llaman `tramo0a30…` por el contrato). */
export function agruparCobros(deudas: readonly DeudaPorCobrar[], hoy: string): CobroDeCliente[] {
  const porCliente = new Map<string, CobroDeCliente>();
  for (const d of deudas) {
    if (d.saldoCentimos <= 0 || !tocaCobrar(d, hoy)) continue;
    const dias = diasVencida(d, hoy);
    const c = porCliente.get(d.contactoId) ?? {
      contactoId: d.contactoId, contactoNombre: d.contactoNombre, contactoTelefono: d.contactoTelefono,
      totalCentimos: 0, tramo0a30Centimos: 0, tramo31a60Centimos: 0, tramo61masCentimos: 0, diasMasAntiguo: 0, deudas: 0,
    };
    if (dias <= 30) c.tramo0a30Centimos += d.saldoCentimos;
    else if (dias <= 60) c.tramo31a60Centimos += d.saldoCentimos;
    else c.tramo61masCentimos += d.saldoCentimos;
    c.totalCentimos += d.saldoCentimos;
    c.diasMasAntiguo = Math.max(c.diasMasAntiguo, dias);
    c.deudas += 1;
    porCliente.set(d.contactoId, c);
  }
  return [...porCliente.values()].sort((a, b) => b.diasMasAntiguo - a.diasMasAntiguo || b.totalCentimos - a.totalCentimos || a.contactoNombre.localeCompare(b.contactoNombre, 'es'));
}

/** La deuda de un documento de otro módulo y cómo va. */
export type DeudaConOrigen = { origenTipo: string; origenId: string; estado: string; totalCentimos: number; abonadoCentimos: number };

const ENTIDAD_DE_ORIGEN: Readonly<Record<string, TipoDeEntidadDeMiDia>> = { pedido: 'pedido', produccion: 'orden_trabajo' };

/**
 * «Pagado» o «Debe S/ X» para la entidad de origen; las deudas anuladas o de orígenes desconocidos no dicen nada. Si un
 * pedido u orden tiene más de una deuda, se suman: una sola anotación por entidad (nunca «Pagado» y «Debe» juntos).
 */
export function anotacionesDeDeudas(deudas: readonly DeudaConOrigen[]): Anotacion[] {
  const porEntidad = new Map<string, { tipo: TipoDeEntidadDeMiDia; id: string; total: number; abonado: number }>();
  for (const d of deudas) {
    const tipo = ENTIDAD_DE_ORIGEN[d.origenTipo];
    if (!tipo || d.estado === 'anulada') continue;
    const clave = `${tipo}:${d.origenId}`;
    const e = porEntidad.get(clave) ?? { tipo, id: d.origenId, total: 0, abonado: 0 };
    e.total += d.totalCentimos;
    e.abonado += d.abonadoCentimos;
    porEntidad.set(clave, e);
  }
  return [...porEntidad.values()].map(({ tipo, id, total, abonado }): Anotacion => {
    const entidad = { tipo, id };
    const saldo = total - abonado;
    return saldo <= 0
      ? { entidad, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true }
      : { entidad, texto: `Debe ${formatearSoles(saldo)}`, tono: 'aviso', pagado: false, conAdelanto: abonado > 0 };
  });
}
