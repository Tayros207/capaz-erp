import { diasEntreDias, formatearSoles, sumarDias, type Anotacion, type TipoDeEntidadDeMiDia } from '@capaz/shared';

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

/** Sin vencimiento escrito, la deuda se considera vencida a los 30 días de su fecha (igual que un plazo corriente). */
export const PLAZO_SIN_VENCIMIENTO = 30;

/** Días que lleva vencida (0 o menos: vigente). */
export const diasVencida = (d: Pick<DeudaPorCobrar, 'fecha' | 'venceEn'>, hoy: string): number => diasEntreDias(d.venceEn ?? sumarDias(d.fecha, PLAZO_SIN_VENCIMIENTO), hoy);

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

/** Tramos de lo vencido: 0-30, 31-60 y 61 o más días. */
export function agruparCobros(deudas: readonly DeudaPorCobrar[], hoy: string): CobroDeCliente[] {
  const porCliente = new Map<string, CobroDeCliente>();
  for (const d of deudas) {
    const dias = diasVencida(d, hoy);
    if (d.saldoCentimos <= 0 || dias <= 0) continue;
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

/** «Pagado» o «Debe S/ X» para la entidad de origen; las deudas anuladas o de orígenes desconocidos no dicen nada. */
export function anotacionesDeDeudas(deudas: readonly DeudaConOrigen[]): Anotacion[] {
  const salida: Anotacion[] = [];
  for (const d of deudas) {
    const tipo = ENTIDAD_DE_ORIGEN[d.origenTipo];
    if (!tipo || d.estado === 'anulada') continue;
    const saldo = d.totalCentimos - d.abonadoCentimos;
    const entidad = { tipo, id: d.origenId };
    const conAdelanto = d.abonadoCentimos > 0;
    salida.push(
      saldo <= 0
        ? { entidad, texto: 'Pagado', tono: 'exito', pagado: true, conAdelanto: true }
        : { entidad, texto: `Debe ${formatearSoles(saldo)}`, tono: 'aviso', pagado: false, conAdelanto },
    );
  }
  return salida;
}
