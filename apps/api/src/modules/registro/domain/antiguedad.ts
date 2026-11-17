import type { FilaDeAntiguedadDto, TramoDeAntiguedad } from '@capaz/shared';

// Antigüedad de saldos: puro, sin base ni framework. Cada deuda abierta cae en un tramo según los días que lleva vencida.

export type DeudaAbierta = { contactoId: string; contactoNombre: string; saldoCentimos: number; fecha: string; venceEn: string | null };

const MS_POR_DIA = 86_400_000;

/** Días entre dos días `AAAA-MM-DD` (positivo si `hasta` es posterior). */
export const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA);

/** El tramo de una deuda: sin vencimiento cuenta desde su fecha; hasta el día del vencimiento inclusive sigue vigente. */
export function tramoDe(d: Pick<DeudaAbierta, 'fecha' | 'venceEn'>, corte: string): TramoDeAntiguedad {
  const vencidos = diasEntre(d.venceEn ?? d.fecha, corte);
  if (vencidos <= 0) return 'vigente';
  if (vencidos <= 30) return 'de_1_a_30';
  if (vencidos <= 60) return 'de_31_a_60';
  if (vencidos <= 90) return 'de_61_a_90';
  return 'mas_de_90';
}

const vacia = () => ({ vigenteCentimos: 0, de1a30Centimos: 0, de31a60Centimos: 0, de61a90Centimos: 0, masDe90Centimos: 0, totalCentimos: 0 });
const CAMPO: Record<TramoDeAntiguedad, 'vigenteCentimos' | 'de1a30Centimos' | 'de31a60Centimos' | 'de61a90Centimos' | 'masDe90Centimos'> = {
  vigente: 'vigenteCentimos',
  de_1_a_30: 'de1a30Centimos',
  de_31_a_60: 'de31a60Centimos',
  de_61_a_90: 'de61a90Centimos',
  mas_de_90: 'masDe90Centimos',
};

/** Una fila por contacto (la más pesada primero) y los totales. Ignora deudas sin saldo. */
export function agruparAntiguedad(deudas: readonly DeudaAbierta[], corte: string): { filas: FilaDeAntiguedadDto[]; totales: ReturnType<typeof vacia> } {
  const porContacto = new Map<string, FilaDeAntiguedadDto>();
  const totales = vacia();
  for (const d of deudas) {
    if (d.saldoCentimos <= 0) continue;
    const fila = porContacto.get(d.contactoId) ?? { contactoId: d.contactoId, contactoNombre: d.contactoNombre, deudas: 0, ...vacia() };
    const campo = CAMPO[tramoDe(d, corte)];
    fila[campo] += d.saldoCentimos;
    fila.totalCentimos += d.saldoCentimos;
    fila.deudas += 1;
    totales[campo] += d.saldoCentimos;
    totales.totalCentimos += d.saldoCentimos;
    porContacto.set(d.contactoId, fila);
  }
  const filas = [...porContacto.values()].sort((a, b) => b.totalCentimos - a.totalCentimos || a.contactoNombre.localeCompare(b.contactoNombre, 'es'));
  return { filas, totales };
}
