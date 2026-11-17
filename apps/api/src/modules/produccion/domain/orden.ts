import type { EstadoDeOrdenDeProduccion, EstadoDePagoDeOrden } from '@capaz/shared';

// Reglas puras de las órdenes de trabajo: código, estados, saldo, fechas y avisos. Sin base ni framework.
// Siguen las reglas de SF/Tairos.RC: los estados se mueven libremente mientras la orden esté viva; «entregado» es final;
// una orden anulada solo vuelve a «pendiente».

/** Clave del correlativo (`core.contadores`). */
export const CLAVE_DE_CORRELATIVO = 'produccion.orden';

/** `OT-2026-0007`. */
export const codigoDeOrden = (anio: number, numero: number): string => `OT-${anio}-${String(numero).padStart(4, '0')}`;

const VIVOS: readonly EstadoDeOrdenDeProduccion[] = ['pendiente', 'en_maquina', 'listo'];

export type Comprobacion = { ok: true } | { ok: false; motivo: string };

/** Cambio de estado. El mismo estado no es error (idempotente). */
export function comprobarCambioDeEstado(desde: EstadoDeOrdenDeProduccion, a: EstadoDeOrdenDeProduccion): Comprobacion {
  if (desde === a) return { ok: true };
  if (desde === 'entregado') return { ok: false, motivo: 'La orden ya se entregó y su estado no se puede cambiar.' };
  if (desde === 'anulada' && a !== 'pendiente') return { ok: false, motivo: 'La orden anulada solo puede volver a pendiente.' };
  return { ok: true };
}

/** Se anula mientras no esté entregada ni anulada. */
export const sePuedeAnular = (estado: EstadoDeOrdenDeProduccion): boolean => VIVOS.includes(estado);

/** Se edita en todos los estados menos entregada; anulada primero se retoma. */
export const sePuedeEditar = (estado: EstadoDeOrdenDeProduccion): boolean => VIVOS.includes(estado);

/** Lo que falta cancelar. */
export const saldoDe = (totalCentimos: number, adelantoCentimos: number): number => totalCentimos - adelantoCentimos;

export function estadoDePago(totalCentimos: number, adelantoCentimos: number): EstadoDePagoDeOrden {
  if (adelantoCentimos <= 0) return 'sin_adelanto';
  return saldoDe(totalCentimos, adelantoCentimos) <= 0 ? 'pagado' : 'con_adelanto';
}

/** Total mayor que cero y adelanto entre cero y el total (puede igualarlo). */
export function comprobarMontos(o: { totalCentimos: number; adelantoCentimos: number }): Comprobacion {
  if (o.totalCentimos <= 0) return { ok: false, motivo: 'El total de la orden debe ser mayor a cero.' };
  if (o.adelantoCentimos < 0) return { ok: false, motivo: 'El adelanto no puede ser negativo.' };
  if (o.adelantoCentimos > o.totalCentimos) return { ok: false, motivo: 'El adelanto no puede superar el total del trabajo.' };
  return { ok: true };
}

/** La entrega no puede ser anterior a la fecha de la orden (días `AAAA-MM-DD`). */
export function comprobarFechas(fecha: string, entregaEl: string | null): Comprobacion {
  return entregaEl !== null && entregaEl < fecha ? { ok: false, motivo: 'La entrega no puede ser anterior a la fecha de la orden.' } : { ok: true };
}

/** Atrasada: sigue viva y su entrega ya pasó respecto de `hoy`. */
export const estaAtrasada = (estado: EstadoDeOrdenDeProduccion, entregaEl: string | null, hoy: string): boolean => entregaEl !== null && entregaEl < hoy && VIVOS.includes(estado);

/** «Mil volantes» o «Mil volantes (+2 más)». */
export const resumenDeLineas = (descripciones: readonly string[]): string => {
  const [primera = 'Sin líneas', ...resto] = descripciones;
  return resto.length > 0 ? `${primera} (+${resto.length} más)` : primera;
};

/** Anular con adelanto exige decir su destino; sin adelanto no hace falta. */
export function comprobarAnulacion(adelantoCentimos: number, destino: string | undefined): Comprobacion {
  if (adelantoCentimos > 0 && !destino) return { ok: false, motivo: 'Este trabajo tiene un adelanto: hay que decir si se devolvió o se retuvo.' };
  return { ok: true };
}

/** Con «retenido» la orden queda por lo que ya se cobró: el total pasa a ser el adelanto y no falta nada. */
export const totalTrasRetener = (adelantoCentimos: number): number => adelantoCentimos;
