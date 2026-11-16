import { ESTADOS_CANCELABLES_DE_COMPRA, ESTADOS_POR_RECIBIR_DE_COMPRA, type EstadoDeCompra } from '@capaz/shared';

// Estados de una orden de compra y sus pasos válidos:
// borrador → enviada (compra_enviar) → recibida_parcial ⇄ … → recibida (compra_recibir);
// borrador o enviada → cancelada (compra_cancelar), solo sin recepciones.

export type Paso = { ok: true } | { ok: false; motivo: string };

/** Cómo se nombra cada estado dentro de una frase. */
export const NOMBRE_DE_ESTADO: Readonly<Record<EstadoDeCompra, string>> = {
  borrador: 'borrador',
  enviada: 'enviada',
  recibida_parcial: 'recibida en parte',
  recibida: 'recibida',
  cancelada: 'cancelada',
};

export const mensajeDePasoInvalido = (de: EstadoDeCompra, a: EstadoDeCompra): string =>
  `Una orden «${NOMBRE_DE_ESTADO[de]}» no puede pasar a «${NOMBRE_DE_ESTADO[a]}».`;

const paso = (valido: boolean, de: EstadoDeCompra, a: EstadoDeCompra): Paso => (valido ? { ok: true } : { ok: false, motivo: mensajeDePasoInvalido(de, a) });

/** `borrador → enviada`: solo con `compra_enviar`. */
export const comprobarEnvio = (de: EstadoDeCompra): Paso => paso(de === 'borrador', de, 'enviada');

const porRecibir = (estado: EstadoDeCompra): boolean => (ESTADOS_POR_RECIBIR_DE_COMPRA as readonly string[]).includes(estado);

/** Se recibe sobre una orden enviada o recibida en parte. */
export function comprobarRecepcion(de: EstadoDeCompra): Paso {
  if (porRecibir(de)) return { ok: true };
  if (de === 'borrador') return { ok: false, motivo: 'Primero envía la orden al proveedor; después registra lo que llega.' };
  return { ok: false, motivo: `Una orden «${NOMBRE_DE_ESTADO[de]}» ya no recibe mercadería.` };
}

/** Solo se cancela una orden en borrador o enviada y sin ninguna recepción. */
export function comprobarCancelacion(de: EstadoDeCompra, recepciones: number): Paso {
  if (recepciones > 0) return { ok: false, motivo: 'La orden ya tiene recepciones: no se puede cancelar.' };
  return paso((ESTADOS_CANCELABLES_DE_COMPRA as readonly string[]).includes(de), de, 'cancelada');
}

/** Una orden solo se edita en borrador. */
export const esEditable = (estado: EstadoDeCompra): boolean => estado === 'borrador';

/** Por recibir (enviada o recibida en parte) con entrega anterior a hoy. Los días son `AAAA-MM-DD`. */
export const estaAtrasada = (estado: EstadoDeCompra, entregaEl: string | null, hoy: string): boolean => entregaEl !== null && porRecibir(estado) && entregaEl < hoy;
