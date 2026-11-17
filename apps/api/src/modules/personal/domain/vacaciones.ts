// Reglas puras de contratos y vacaciones: sin base ni framework. Los días de vacaciones se cuentan corridos (calendario).

/** Días devengados por mes completo de servicio: 30 al año (2,5 por mes). Es una referencia, no asesoría legal. */
export const DIAS_DE_VACACIONES_POR_MES = 2.5;

const MS_POR_DIA = 86_400_000;
const partes = (dia: string): [number, number, number] => {
  const [a, m, d] = dia.split('-').map(Number);
  return [a!, m!, d!];
};

/** Días corridos entre dos días `AAAA-MM-DD`, ambos incluidos (7 al 1 de febrero hasta el 7 de febrero). */
export const diasInclusive = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA) + 1;

/** Meses completos entre dos días: el mes se cumple al llegar al mismo número de día (o fin de mes si no existe). */
export function mesesCompletos(desde: string, hasta: string): number {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  const finDeMes = new Date(Date.UTC(a2, m2, 0)).getUTCDate();
  if (d2 < Math.min(d1, finDeMes)) meses -= 1;
  return Math.max(0, meses);
}

export type SaldoDeVacaciones = { devengadosDias: number; gozadosDias: number; porAprobarDias: number; saldoDias: number };

/** Devengado por antigüedad menos lo ya aprobado; las solicitudes pendientes se muestran aparte y no descuentan. */
export function saldoDeVacaciones(i: { fechaIngreso: string | null; corte: string; aprobadasDias: number; solicitadasDias: number }): SaldoDeVacaciones {
  const devengadosDias = i.fechaIngreso ? Math.floor(mesesCompletos(i.fechaIngreso, i.corte) * DIAS_DE_VACACIONES_POR_MES) : 0;
  return { devengadosDias, gozadosDias: i.aprobadasDias, porAprobarDias: i.solicitadasDias, saldoDias: devengadosDias - i.aprobadasDias };
}

/** ¿Dos rangos de días (extremos incluidos) se pisan? */
export const seSolapan = (a: { desde: string; hasta: string }, b: { desde: string; hasta: string }): boolean => a.desde <= b.hasta && b.desde <= a.hasta;

export type Comprobacion = { ok: true } | { ok: false; motivo: string };

/** Un plazo fijo o unas prácticas necesitan fecha de fin; el fin no puede ser anterior al inicio. */
export function comprobarContrato(c: { tipo: string; inicio: string; fin: string | null }): Comprobacion {
  if (c.fin !== null && c.fin < c.inicio) return { ok: false, motivo: 'El fin del contrato no puede ser anterior a su inicio.' };
  if ((c.tipo === 'plazo_fijo' || c.tipo === 'practicas') && c.fin === null) return { ok: false, motivo: 'Un contrato a plazo fijo o de prácticas necesita su fecha de fin.' };
  return { ok: true };
}
