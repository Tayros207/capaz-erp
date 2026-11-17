import type { SugerenciaDeCaptura } from '@capaz/shared';

// Lógica pura de las tarjetas de borrador: detectar «sin cambios», editar argumentos y aplicar sugerencias.

export type ArgsEditables = Record<string, unknown>;

export const comoArgs = (args: unknown): ArgsEditables => (args !== null && typeof args === 'object' && !Array.isArray(args) ? { ...(args as ArgsEditables) } : {});

const vacio = (v: unknown): boolean => v === null || v === undefined || v === '';

/** Orden de claves estable y sin valores vacíos: `null`, ausente y `''` son lo mismo. */
function normalizar(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizar);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => !vacio(x))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, x]) => [k, normalizar(x)]),
    );
  }
  return v;
}

/** `true` si la persona no cambió nada: entonces solo se aprueba, sin `borrador_corregir`. */
export const sinCambios = (original: unknown, actual: unknown): boolean => JSON.stringify(normalizar(original)) === JSON.stringify(normalizar(actual));

/** Nuevos argumentos con un campo cambiado; un valor vacío quita el campo. */
export function conCampo(args: ArgsEditables, clave: string, valor: unknown): ArgsEditables {
  const siguiente = { ...args };
  if (vacio(valor)) delete siguiente[clave];
  else siguiente[clave] = valor;
  return siguiente;
}

/** Aplica la opción elegida de una sugerencia al campo que ella nombra. */
export function aplicarOpcion(args: ArgsEditables, sugerencia: SugerenciaDeCaptura, opcionId: string): ArgsEditables {
  return sugerencia.opciones.some((o) => o.id === opcionId) ? conCampo(args, sugerencia.campo, opcionId) : args;
}

export const sugerenciaDe = (sugerencias: readonly SugerenciaDeCaptura[], campo: string): SugerenciaDeCaptura | undefined => sugerencias.find((s) => s.campo === campo);

export const centimosDe = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
export const textoDe = (v: unknown): string => (typeof v === 'string' ? v : '');
