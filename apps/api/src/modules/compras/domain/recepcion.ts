import { importeDeRecepcion, type EstadoDeCompra } from '@capaz/shared';

// Reglas puras de una recepción: qué líneas llegan, que no se reciba más de lo pedido, el valor de lo
// recibido y el estado en que queda la orden. Sin base ni framework.

/** Lo que una recepción necesita de cada línea de la orden (leída con la orden bloqueada). */
export type LineaDeOrden = {
  id: string;
  productoId: string | null;
  descripcion: string;
  unidad: string;
  cantidadMilesimas: number;
  costoUnitarioMilesimas: number;
  recibidoMilesimas: number;
};

export type LineaRecibida = { ordenLineaId: string; cantidadMilesimas: number };

export type LineaDeRecepcion = { ordenLineaId: string; productoId: string | null; cantidadMilesimas: number; costoUnitarioMilesimas: number };

export type RecepcionPreparada =
  | { ok: true; lineas: LineaDeRecepcion[]; totalRecibidoCentimos: number; estadoNuevo: Extract<EstadoDeCompra, 'recibida' | 'recibida_parcial'> }
  | { ok: false; codigo: 'argumentos_invalidos' | 'conflicto'; motivo: string };

/** 1500 → «1.5»; 2000, «caja» → «2 caja». Para los mensajes. */
export function cantidadComoTexto(milesimas: number, unidad = ''): string {
  const enteros = Math.trunc(milesimas / 1000);
  const decimales = String(milesimas % 1000).padStart(3, '0').replace(/0+$/, '');
  const numero = decimales ? `${enteros}.${decimales}` : String(enteros);
  return unidad.trim() ? `${numero} ${unidad.trim()}` : numero;
}

export const pendienteDe = (l: Pick<LineaDeOrden, 'cantidadMilesimas' | 'recibidoMilesimas'>): number => l.cantidadMilesimas - l.recibidoMilesimas;

const invalido = (motivo: string): RecepcionPreparada => ({ ok: false, codigo: 'argumentos_invalidos', motivo });

/**
 * Comprueba lo recibido contra las líneas de la orden: cada línea una vez, de esta orden y sin pasar de
 * lo pendiente (pedido − ya recibido). Devuelve las líneas con su producto y costo (para el evento), el
 * valor recibido y el estado nuevo: `recibida` si con esto ya llegó todo, si no `recibida_parcial`.
 */
export function prepararRecepcion(lineasDeOrden: readonly LineaDeOrden[], recibidas: readonly LineaRecibida[]): RecepcionPreparada {
  if (recibidas.length === 0) return invalido('Indica al menos una línea recibida.');
  const porId = new Map(lineasDeOrden.map((l) => [l.id, l]));
  const nuevas = new Map<string, number>();
  const lineas: LineaDeRecepcion[] = [];
  for (const [i, r] of recibidas.entries()) {
    const l = porId.get(r.ordenLineaId);
    if (!l) return invalido(`Línea ${i + 1}: no es una línea de esta orden.`);
    if (nuevas.has(l.id)) return invalido('Cada línea de la orden va una sola vez en la recepción.');
    if (!Number.isSafeInteger(r.cantidadMilesimas) || r.cantidadMilesimas <= 0) return invalido(`Línea ${i + 1}: la cantidad debe ser mayor que cero.`);
    const pendiente = pendienteDe(l);
    if (r.cantidadMilesimas > pendiente) {
      const falta = pendiente === 0 ? 'ya se recibió completa' : `solo falta recibir ${cantidadComoTexto(pendiente, l.unidad)}`;
      return { ok: false, codigo: 'conflicto', motivo: `«${l.descripcion}»: llegan ${cantidadComoTexto(r.cantidadMilesimas, l.unidad)} y ${falta}.` };
    }
    nuevas.set(l.id, r.cantidadMilesimas);
    lineas.push({ ordenLineaId: l.id, productoId: l.productoId, cantidadMilesimas: r.cantidadMilesimas, costoUnitarioMilesimas: l.costoUnitarioMilesimas });
  }
  let totalRecibidoCentimos: number;
  try {
    totalRecibidoCentimos = importeDeRecepcion(lineas);
  } catch {
    return invalido('El importe de la recepción es demasiado grande.');
  }
  const completa = lineasDeOrden.every((l) => l.recibidoMilesimas + (nuevas.get(l.id) ?? 0) === l.cantidadMilesimas);
  return { ok: true, lineas, totalRecibidoCentimos, estadoNuevo: completa ? 'recibida' : 'recibida_parcial' };
}

/** La recepción no es anterior a la orden ni posterior a hoy (días `AAAA-MM-DD`). */
export function comprobarFechaDeRecepcion(fechaDeLaOrden: string, fecha: string, hoy: string): { ok: true } | { ok: false; motivo: string } {
  if (fecha < fechaDeLaOrden) return { ok: false, motivo: 'La recepción no puede ser anterior a la fecha de la orden.' };
  if (fecha > hoy) return { ok: false, motivo: 'La recepción no puede tener una fecha futura.' };
  return { ok: true };
}
