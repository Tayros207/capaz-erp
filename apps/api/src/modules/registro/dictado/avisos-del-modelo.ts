// Convierte los avisos de la fusión con el modelo en frases para `faltan`. Formatea con @capaz/shared (soles): está en la excepción
// de pureza.spec, como propuesta-de-pedido.
import { formatearSoles } from '@capaz/shared';
import type { AvisoDelModelo, ValorDictado } from './elegir.js';
import { fechaCorta } from './propuesta-de-pedido.js';

/** Precio por unidad en milésimas de sol: «S/ 0.365»; si cabe en céntimos, como cualquier monto. Sin coma flotante. */
function milesimasComoSoles(milesimas: number): string {
  if (milesimas % 10 === 0) return formatearSoles(milesimas / 10);
  return `S/ ${Math.trunc(milesimas / 1000).toLocaleString('en-US')}.${String(milesimas % 1000).padStart(3, '0')}`;
}

function valorComoTexto(v: ValorDictado): string {
  if (v.tipo === 'centimos') return formatearSoles(v.valor);
  if (v.tipo === 'milesimas') return milesimasComoSoles(v.valor);
  if (v.tipo === 'dia') return fechaCorta(v.valor);
  return v.valor;
}

const mayuscula = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

export function textoDeAviso(a: AvisoDelModelo): string {
  if (a.motivo === 'distinto') {
    const quedo = valorComoTexto(a.reglas);
    return `${mayuscula(a.campo)}: en lo dictado se lee ${quedo} y el asistente entendió ${valorComoTexto(a.modelo)}; quedó ${quedo}, revísalo`;
  }
  if (a.motivo === 'no_aparece') return `${mayuscula(a.campo)} (${valorComoTexto(a.modelo)}) no aparece tal cual en lo dictado: revísalo`;
  return `No entendí ${a.campo} «${valorComoTexto(a.modelo)}»: ponla a mano`;
}
