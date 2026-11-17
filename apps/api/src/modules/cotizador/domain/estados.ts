// Estados de una cotización y sus pasos permitidos (FICHAS-OLA-4 §10.2). Tabla pura: la usan las herramientas.
import { ESTADOS_DE_COTIZACION } from '@capaz/shared';

export type EstadoDeCotizacion = (typeof ESTADOS_DE_COTIZACION)[number];
export type PasoDeCotizacion = 'emitir' | 'enviar' | 'aceptar' | 'rechazar' | 'nueva_version' | 'anular';
export type Paso = { ok: true } | { ok: false; motivo: string };

export const NOMBRE_DE_ESTADO: Readonly<Record<EstadoDeCotizacion, string>> = {
  borrador: 'borrador',
  emitida: 'emitida',
  enviada: 'enviada',
  aceptada: 'aceptada',
  rechazada: 'rechazada',
  anulada: 'anulada',
};

/** Desde qué estados se puede dar cada paso. `anular` vale desde cualquiera menos `anulada`. */
export const PASOS_PERMITIDOS: Readonly<Record<PasoDeCotizacion, readonly EstadoDeCotizacion[]>> = {
  emitir: ['borrador'],
  enviar: ['emitida'],
  aceptar: ['emitida', 'enviada'],
  rechazar: ['emitida', 'enviada'],
  nueva_version: ['emitida', 'enviada', 'rechazada'],
  anular: ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada'],
};

const MOTIVOS: Readonly<Record<PasoDeCotizacion, (e: EstadoDeCotizacion) => string>> = {
  emitir: (e) => (e === 'anulada' ? 'La cotización está anulada.' : 'Solo se emite una cotización en borrador.'),
  enviar: () => 'Solo se marca como enviada una cotización emitida.',
  aceptar: (e) => (e === 'aceptada' ? 'La cotización ya fue aceptada.' : 'Solo se acepta una cotización emitida o enviada.'),
  rechazar: (e) => (e === 'rechazada' ? 'La cotización ya fue rechazada.' : 'Solo se rechaza una cotización emitida o enviada.'),
  nueva_version: () => 'Solo se hace una nueva versión de una cotización emitida, enviada o rechazada.',
  anular: () => 'La cotización ya está anulada.',
};

export function comprobarPaso(estado: EstadoDeCotizacion, paso: PasoDeCotizacion): Paso {
  return PASOS_PERMITIDOS[paso].includes(estado) ? { ok: true } : { ok: false, motivo: MOTIVOS[paso](estado) };
}

/** Solo se edita en borrador. */
export const esEditable = (estado: EstadoDeCotizacion): boolean => estado === 'borrador';

/** El estado al que lleva un paso (`nueva_version` vuelve a borrador). */
export const ESTADO_DESTINO: Readonly<Record<PasoDeCotizacion, EstadoDeCotizacion>> = {
  emitir: 'emitida',
  enviar: 'enviada',
  aceptar: 'aceptada',
  rechazar: 'rechazada',
  nueva_version: 'borrador',
  anular: 'anulada',
};
