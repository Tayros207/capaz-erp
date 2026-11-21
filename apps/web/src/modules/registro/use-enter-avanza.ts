import type { KeyboardEvent } from 'react';

const SALTA = 'input:not([type=hidden]):not([disabled]):not([type=checkbox]), select:not([disabled]), textarea:not([disabled])';

/**
 * Enter pasa al siguiente campo en vez de enviar la hoja (se envía con el botón, o con Enter en el último campo). No toca las
 * listas de búsqueda abiertas (ellas usan Enter para elegir) ni las notas de varias líneas.
 */
export function enterAvanza(e: KeyboardEvent<HTMLFormElement>): void {
  if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey) return;
  const actual = e.target;
  if (!(actual instanceof HTMLInputElement || actual instanceof HTMLSelectElement)) return;
  const campos = [...e.currentTarget.querySelectorAll<HTMLElement>(SALTA)].filter((c) => c.offsetParent !== null);
  const siguiente = campos[campos.indexOf(actual) + 1];
  if (!siguiente) return; // el último campo deja que Enter envíe
  e.preventDefault();
  siguiente.focus();
}

/** Lleva el foco al primer control del bloque con ese `data-campo` y lo muestra en pantalla. */
export function enfocarCampo(raiz: HTMLElement | null, campo: string): void {
  const bloque = raiz?.querySelector<HTMLElement>(`[data-campo="${campo}"]`);
  const control = bloque?.querySelector<HTMLElement>('input, select, textarea, button');
  (control ?? bloque)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  control?.focus({ preventScroll: true });
}
