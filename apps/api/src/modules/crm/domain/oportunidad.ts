import type { TipoDeEtapa } from './etapas.js';

// Reglas puras de las oportunidades y sus actividades (FICHAS-OLA-2 §5.2, reglas 1, 3 y 4).

export type EstadoDeOportunidad = 'abierta' | 'ganada' | 'perdida';
export type Problema = { codigo: 'conflicto' | 'argumentos_invalidos'; mensaje: string };

/** Clave del correlativo de oportunidades (sin serie, por año). */
export const CLAVE_DE_OPORTUNIDAD = 'crm.oportunidad';

/** `OPO-2026-0001`: año y número con al menos 4 cifras. */
export const codigoDeOportunidad = (anio: number, numero: number): string => `OPO-${anio}-${String(numero).padStart(4, '0')}`;

const CERRADA: Problema = { codigo: 'conflicto', mensaje: 'La oportunidad está cerrada: reábrela primero.' };
const ETAPA_DE_CIERRE: Problema = {
  codigo: 'argumentos_invalidos',
  mensaje: 'Solo se mueve a etapas abiertas: para cerrar usa «Ganada» o «Perdida».',
};

/** Etapa de destino al crear o mover: debe ser abierta y estar viva. */
export function problemaDeEtapaDestino(etapa: { tipo: TipoDeEtapa; archivada: boolean }): Problema | null {
  if (etapa.tipo !== 'abierta') return ETAPA_DE_CIERRE;
  if (etapa.archivada) return { codigo: 'conflicto', mensaje: 'Esa etapa está archivada.' };
  return null;
}

/** Mover: solo oportunidades abiertas y solo hacia etapas abiertas. */
export function problemaParaMover(estado: EstadoDeOportunidad, destino: { tipo: TipoDeEtapa; archivada: boolean }): Problema | null {
  if (estado !== 'abierta') return CERRADA;
  return problemaDeEtapaDestino(destino);
}

/** Ganar o perder: solo una oportunidad abierta. */
export function problemaParaCerrar(estado: EstadoDeOportunidad): Problema | null {
  return estado === 'abierta' ? null : { codigo: 'conflicto', mensaje: estado === 'ganada' ? 'La oportunidad ya está ganada.' : 'La oportunidad ya está perdida.' };
}

/** Reabrir: solo una cerrada. */
export function problemaParaReabrir(estado: EstadoDeOportunidad): Problema | null {
  return estado === 'abierta' ? { codigo: 'conflicto', mensaje: 'La oportunidad ya está abierta.' } : null;
}

/** Una actividad está vencida si no está hecha y su día de vencimiento es anterior a hoy (día local de la empresa). */
export const actividadVencida = (venceEl: string | null, hecha: boolean, hoy: string): boolean => !hecha && venceEl !== null && venceEl < hoy;
