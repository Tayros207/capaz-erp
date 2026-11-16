import type { ContextoDeHerramienta } from '../herramientas/tipos.js';

/** `'propios'` solo si el acceso de ese módulo dice `alcance: 'propios'`; en cualquier otro caso `'todos'`. */
export function alcanceDe(ctx: ContextoDeHerramienta, modulo: string): 'todos' | 'propios' {
  return ctx.modulos.find((m) => m.codigo === modulo)?.alcance === 'propios' ? 'propios' : 'todos';
}
