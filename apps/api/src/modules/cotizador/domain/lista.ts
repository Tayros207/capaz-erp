// Reglas de la lista de precios que no dependen de la base. Puras.
import { DIAS_PARA_REVISAR_PRECIO, formatearSoles } from '@capaz/shared';
import { validarLista, type ModoIntermedio, type Rechazo, type ReferenciasEnCentimos } from './precios.js';

/** Nombre para comparar: sin tildes, en minúsculas y con espacios simples. */
export function normalizarNombre(nombre: string): string {
  return nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** El día `AAAA-MM-DD` desplazado `n` días (negativo: hacia atrás). */
export function diaMas(dia: string, n: number): string {
  const f = new Date(`${dia}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + n);
  return f.toISOString().slice(0, 10);
}

/** Más de `DIAS_PARA_REVISAR_PRECIO` días desde que se fijaron los precios (días de la empresa). */
export const estaPorRevisar = (fijadoEnDia: string, hoyDia: string): boolean => fijadoEnDia < diaMas(hoyDia, -DIAS_PARA_REVISAR_PRECIO);

/** El día contable más antiguo que todavía no está «por revisar». */
export const corteParaRevisar = (hoyDia: string): string => diaMas(hoyDia, -DIAS_PARA_REVISAR_PRECIO);

/** Lo que cuentan las referencias: B bloquea; A avisa y pide confirmación (`confirmar`). */
export function evaluarReferencias(r: ReferenciasEnCentimos, confirmar: boolean): { ok: true; aConfirmado: boolean } | Rechazo {
  const v = validarLista(r);
  const bloqueo = v.bloqueos[0];
  if (bloqueo) return { ok: false, codigo: 'argumentos_invalidos', mensaje: bloqueo };
  const aviso = v.avisos[0];
  if (aviso && !confirmar) return { ok: false, codigo: 'conflicto', mensaje: `${aviso} Confirma para guardarlo igual.` };
  return { ok: true, aConfirmado: aviso !== undefined };
}

export type EstadoDePrecios = ReferenciasEnCentimos & { modoIntermedio: ModoIntermedio; precioMinimoCentimos: number | null };

const REFERENCIAS = [
  ['100', 'p100Centimos'],
  ['1.000', 'p1000Centimos'],
  ['5.000', 'p5000Centimos'],
] as const;
const MODOS = { curva: 'curva', escalon: 'escalón' } as const;
const soles = (c: number | null): string => (c === null ? 'sin mínimo' : formatearSoles(c));

/** ¿Cambió algo que obliga a volver a fijar la fecha de los precios? (no renombrar, no cambiar la unidad) */
export const cambiaronLosPrecios = (a: EstadoDePrecios, b: EstadoDePrecios): boolean =>
  REFERENCIAS.some(([, k]) => a[k] !== b[k]) || a.modoIntermedio !== b.modoIntermedio || a.precioMinimoCentimos !== b.precioMinimoCentimos;

/** «Cambiarás los precios de «Volantes A5»: 100 → S/ 190.00 (antes S/ 180.00), …». */
export function resumenDeCambioDePrecios(nombre: string, antes: EstadoDePrecios, despues: EstadoDePrecios): string {
  const partes: string[] = REFERENCIAS.filter(([, k]) => antes[k] !== despues[k]).map(([c, k]) => `${c} → ${soles(despues[k])} (antes ${soles(antes[k])})`);
  if (antes.modoIntermedio !== despues.modoIntermedio) partes.push(`entre referencias: ${MODOS[despues.modoIntermedio]} (antes ${MODOS[antes.modoIntermedio]})`);
  if (antes.precioMinimoCentimos !== despues.precioMinimoCentimos) partes.push(`mínimo ${soles(despues.precioMinimoCentimos)} (antes ${soles(antes.precioMinimoCentimos)})`);
  const cuerpo = partes.length > 0 ? `: ${partes.join(', ')}` : '';
  return partes.length > 0 ? `Cambiarás los precios de «${nombre}»${cuerpo}. Las cotizaciones nuevas usarán estos precios.` : `Cambiarás los datos de «${nombre}».`;
}
