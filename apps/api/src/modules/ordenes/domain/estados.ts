import { AVANCES_DE_PEDIDO, ESTADOS_DE_DATOS_EDITABLES_DE_PEDIDO, ESTADOS_CANCELABLES_DE_PEDIDO, ESTADOS_EN_CURSO_DE_PEDIDO, type EstadoDePedido } from '@capaz/shared';

// Estados de un pedido y sus pasos válidos. La tabla (`AVANCES_DE_PEDIDO`) vive en `@capaz/shared`
// porque la pantalla ofrece exactamente lo que aquí se permite; estas funciones la hacen cumplir.

export type Paso = { ok: true } | { ok: false; motivo: string };

/** Cómo se nombra cada estado dentro de una frase. */
export const NOMBRE_DE_ESTADO: Readonly<Record<EstadoDePedido, string>> = {
  borrador: 'borrador',
  confirmado: 'confirmado',
  en_proceso: 'en proceso',
  listo: 'listo',
  entregado: 'entregado',
  cancelado: 'cancelado',
};

export const mensajeDePasoInvalido = (de: EstadoDePedido, a: EstadoDePedido): string =>
  `Un pedido «${NOMBRE_DE_ESTADO[de]}» no puede pasar a «${NOMBRE_DE_ESTADO[a]}».`;

const paso = (valido: boolean, de: EstadoDePedido, a: EstadoDePedido): Paso => (valido ? { ok: true } : { ok: false, motivo: mensajeDePasoInvalido(de, a) });

/** `borrador → confirmado`: solo con `pedido_confirmar`. */
export const comprobarConfirmacion = (de: EstadoDePedido): Paso => paso(de === 'borrador', de, 'confirmado');

/** Pasos de `pedido_cambiar_estado` (nunca desde borrador, entregado ni cancelado). */
export const comprobarAvance = (de: EstadoDePedido, a: EstadoDePedido): Paso => paso(AVANCES_DE_PEDIDO[de].includes(a), de, a);

/** `pedido_cancelar`: desde cualquier estado abierto. */
export const comprobarCancelacion = (de: EstadoDePedido): Paso => paso(ESTADOS_CANCELABLES_DE_PEDIDO.includes(de), de, 'cancelado');

/** Un pedido solo se edita en borrador. */
export const esEditable = (estado: EstadoDePedido): boolean => estado === 'borrador';

/** Entrega, responsable y notas (sin dinero) se corrigen con el pedido confirmado, en proceso o listo; no en borrador (ahí va `pedido_editar`) ni cerrado. */
export function comprobarEdicionDeDatos(estado: EstadoDePedido): Paso {
  if ((ESTADOS_DE_DATOS_EDITABLES_DE_PEDIDO as readonly string[]).includes(estado)) return { ok: true };
  if (estado === 'borrador') return { ok: false, motivo: 'Un pedido en borrador se edita con «Editar pedido»; esta corrección es para pedidos ya confirmados.' };
  return { ok: false, motivo: `Un pedido «${NOMBRE_DE_ESTADO[estado]}» ya no se puede corregir.` };
}

/** En curso (confirmado, en proceso o listo) con entrega anterior a hoy. Los días son `AAAA-MM-DD`. */
export const estaAtrasado = (estado: EstadoDePedido, entregaEl: string | null, hoy: string): boolean =>
  entregaEl !== null && (ESTADOS_EN_CURSO_DE_PEDIDO as readonly string[]).includes(estado) && entregaEl < hoy;
