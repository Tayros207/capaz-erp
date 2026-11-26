import type { Yo } from '@capaz/shared';
import type { Resolucion } from './logica-hilo.ts';

// Textos y reglas del panel que se pueden probar sin DOM.

/** Aviso fijo mientras el asistente no tiene modelo: por ahora solo registra lo que se dicta o escribe. */
export const AVISO_SIN_IA = 'Por ahora puedo registrar lo que dictes o escribas. Las preguntas llegan cuando se active el asistente.';
/** El tope del mes se alcanzó: el asistente con modelo se detiene, pero registrar lo que se dicta sigue funcionando. */
export const AVISO_TOPE = 'Se alcanzó el tope de uso de este mes. Por ahora puedo registrar lo que dictes o escribas; las preguntas vuelven el mes que viene o cuando se suba el tope.';
export const AVISO_SIN_PERMISO = 'Tu usuario no puede registrar por dictado. Pide acceso a Finanzas a tu administrador.';
export const SALUDO_VACIO = 'Dime qué quieres registrar.';
export const SALUDO_CON_ASISTENTE = 'Pregúntame lo que necesites del negocio, o dime qué quieres registrar.';
export const MARCADOR_DE_LA_CAJA = 'Pregunta o registra algo…';
export const TEXTO_DEL_HISTORIAL_VACIO = 'Aquí aparecerán tus conversaciones cuando el asistente esté activo.';

/** Lo que se muestra en lugar de la tarjeta cuando un borrador ya se resolvió. */
export const ETIQUETA_DE_RESOLUCION: Record<Resolucion, string> = {
  aprobado: 'Aprobado',
  descartado: 'Descartado',
  despues: 'Queda en la bandeja',
};

/**
 * Dictar propone borradores del módulo Registro, así que hace falta poder ver la bandeja y poder escribir en Registro.
 * El servidor lo vuelve a comprobar: esto solo decide si se ofrece la caja o se explica por qué no.
 */
export function puedeDictar(yo: Pick<Yo, 'permisos' | 'modulos'>): boolean {
  if (!yo.permisos.includes('borradores:ver')) return false;
  const acceso = yo.modulos.find((m) => m.codigo === 'registro')?.acceso;
  return acceso?.puedeEntrar === true && acceso.puedeEscribir === true;
}
