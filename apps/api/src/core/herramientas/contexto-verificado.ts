import type { ContextoDeHerramienta } from './tipos.js';

// Lo que el cliente ya pagó por un pedido, averiguado en Finanzas por la composición `venta_corregir` (con el contexto y los
// permisos de la persona) para `pedido_corregir`. No viaja como argumento: un argumento lo escribe quien llama (por HTTP o el
// agente) y podría decir «no tiene abonos» para cambiar el cliente o dejar saldo a favor sin aprobación. Un contexto marcado aquí
// solo lo crea el servidor; la puerta HTTP arma siempre uno nuevo, sin marca. `ejecutarDentro` pasa el mismo objeto a la herramienta.

const abonados = new WeakMap<ContextoDeHerramienta, number>();

/** Copia del contexto con lo abonado ya comprobado. */
export function conAbonadoVerificado(ctx: ContextoDeHerramienta, abonadoCentimos: number): ContextoDeHerramienta {
  const marcado: ContextoDeHerramienta = { ...ctx };
  abonados.set(marcado, abonadoCentimos);
  return marcado;
}

/** Lo abonado que comprobó el servidor; `null` si nadie lo comprobó (no se sabe). */
export const abonadoVerificado = (ctx: ContextoDeHerramienta): number | null => abonados.get(ctx) ?? null;
