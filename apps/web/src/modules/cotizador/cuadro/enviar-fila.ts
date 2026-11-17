import { agregarFila, editarFila } from './api-cuadro.ts';
import type { Fila } from './logica-cuadro.ts';
import { argumentosDeFilaNueva, cambiosDeFila, formularioDeFila, type FormularioDeFila } from './logica-cuadro-filas.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Agrega la fila, o aplica una a una las ediciones que cambiaron. Devuelve si todo se aplicó. */
export async function enviarFila(ctx: ContextoDelCuadro, existente: Fila | null, f: FormularioDeFila, aMano: boolean): Promise<boolean> {
  if (!existente) return ctx.aplicar(agregarFila(argumentosDeFilaNueva(ctx.id, f, aMano)));
  for (const c of cambiosDeFila(formularioDeFila(existente), f, ctx.costos)) {
    if (!(await ctx.aplicar(editarFila({ id: ctx.id, linea: { id: existente.id }, ...c })))) return false;
  }
  return true;
}
