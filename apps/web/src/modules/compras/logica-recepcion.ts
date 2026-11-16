import { importeDeRecepcion, type CompraCompletaDto, type EntradaDe } from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';

// Lógica pura de la pantalla de recepción: una fila por línea con algo pendiente, lo que llegó de cada
// una y lo que pasará con la orden. El servidor vuelve a comprobarlo todo con la orden bloqueada.

export type FilaDeRecepcion = {
  ordenLineaId: string;
  descripcion: string;
  unidad: string;
  pedidoMilesimas: number;
  recibidoMilesimas: number;
  pendienteMilesimas: number;
  costoUnitarioMilesimas: number;
  /** Lo que llegó ahora; nulo o cero = no llegó nada de esta línea. */
  cantidadMilesimas: number | null;
};

export const filasDeRecepcion = (c: CompraCompletaDto): FilaDeRecepcion[] =>
  c.detalle
    .filter((l) => l.pendienteMilesimas > 0)
    .map((l) => ({
      ordenLineaId: l.id,
      descripcion: l.descripcion,
      unidad: l.unidad,
      pedidoMilesimas: l.cantidadMilesimas,
      recibidoMilesimas: l.recibidoMilesimas,
      pendienteMilesimas: l.pendienteMilesimas,
      costoUnitarioMilesimas: l.costoUnitarioMilesimas,
      cantidadMilesimas: null,
    }));

/** «Llegó todo»: cada fila con su pendiente. */
export const recibirTodo = (filas: readonly FilaDeRecepcion[]): FilaDeRecepcion[] => filas.map((f) => ({ ...f, cantidadMilesimas: f.pendienteMilesimas }));

const llego = (f: FilaDeRecepcion): f is FilaDeRecepcion & { cantidadMilesimas: number } => f.cantidadMilesimas !== null && f.cantidadMilesimas > 0;

export type ErroresDeRecepcion = { filas: Record<string, string>; fecha?: string; general?: string };
export const sinErrores = (e: ErroresDeRecepcion): boolean => Object.keys(e.filas).length === 0 && !e.fecha && !e.general;

/** `fechaDeLaOrden` y `hoy` son días `AAAA-MM-DD`: la recepción va entre los dos. */
export function validarRecepcion(filas: readonly FilaDeRecepcion[], fecha: string, limites: { fechaDeLaOrden: string; hoy: string }): ErroresDeRecepcion {
  const e: ErroresDeRecepcion = { filas: {} };
  for (const f of filas) {
    if (llego(f) && f.cantidadMilesimas > f.pendienteMilesimas) e.filas[f.ordenLineaId] = `Solo falta recibir ${formatearCantidad(f.pendienteMilesimas, f.unidad)}.`;
  }
  if (!filas.some(llego)) e.general = 'Anota lo que llegó de al menos una línea.';
  if (!fecha) e.fecha = 'Indica el día en que llegó.';
  else if (fecha < limites.fechaDeLaOrden) e.fecha = 'No puede ser anterior a la fecha de la orden.';
  else if (fecha > limites.hoy) e.fecha = 'No puede ser una fecha futura.';
  return e;
}

/** Solo las líneas que llegaron. Se llama con filas que pasaron `validarRecepcion`. */
export function argumentosDeRecepcion(id: string, filas: readonly FilaDeRecepcion[], fecha: string, nota: string): EntradaDe<'compra_recibir'> {
  return {
    id,
    fecha,
    ...(nota.trim() && { nota: nota.trim() }),
    lineas: filas.filter(llego).map((f) => ({ ordenLineaId: f.ordenLineaId, cantidadMilesimas: f.cantidadMilesimas })),
  };
}

export type VistaPrevia = { lineas: number; importeCentimos: number | null; completa: boolean };

/**
 * Lo que se va a registrar: cuántas líneas llegan, su valor (IGV incluido, con la misma cuenta del
 * servidor; nulo si algo no cabe) y si con esto la orden queda recibida del todo. Lo que pasa de lo
 * pendiente no cuenta como completo.
 */
export function vistaPrevia(filas: readonly FilaDeRecepcion[]): VistaPrevia {
  const llegan = filas.filter(llego);
  let importeCentimos: number | null;
  try {
    importeCentimos = importeDeRecepcion(llegan);
  } catch {
    importeCentimos = null;
  }
  return { lineas: llegan.length, importeCentimos, completa: filas.length > 0 && filas.every((f) => f.cantidadMilesimas === f.pendienteMilesimas) };
}
