import type { ConteoDto, EntradaDe } from '@capaz/shared';
import type { OpcionDeRegistro } from './logica.ts';

// Reglas puras de las pantallas de transferencias e inventario físico: sin React ni red.

export type LineaDeTransferencia = { clave: number; articulo: OpcionDeRegistro | null; cantidad: number | null };
export type FormularioDeTransferencia = { origenId: string; destinoId: string; nota: string; lineas: LineaDeTransferencia[] };
export type ErroresDeTransferencia = { origenId?: string; destinoId?: string; lineas?: string };

export const lineaVacia = (clave: number): LineaDeTransferencia => ({ clave, articulo: null, cantidad: null });

export function validarTransferencia(f: FormularioDeTransferencia): ErroresDeTransferencia {
  const e: ErroresDeTransferencia = {};
  if (!f.origenId) e.origenId = 'Elige la sucursal de origen.';
  if (!f.destinoId) e.destinoId = 'Elige la sucursal de destino.';
  else if (f.destinoId === f.origenId) e.destinoId = 'El destino debe ser distinto del origen.';
  const llenas = f.lineas.filter((l) => l.articulo || l.cantidad !== null);
  if (llenas.length === 0) e.lineas = 'Agrega al menos un artículo con su cantidad.';
  else if (llenas.some((l) => !l.articulo || !l.cantidad || l.cantidad <= 0)) e.lineas = 'Cada línea necesita artículo y una cantidad mayor que cero.';
  else if (new Set(llenas.map((l) => l.articulo!.id)).size !== llenas.length) e.lineas = 'Un artículo no puede repetirse.';
  return e;
}

export function argumentosDeTransferencia(f: FormularioDeTransferencia): EntradaDe<'transferencia_crear'> {
  return {
    origenSucursalId: f.origenId,
    destinoSucursalId: f.destinoId,
    ...(f.nota.trim() && { nota: f.nota.trim() }),
    lineas: f.lineas.filter((l) => l.articulo && l.cantidad).map((l) => ({ articuloId: l.articulo!.id, cantidadMilesimas: l.cantidad! })),
  };
}

export const ETIQUETA_DE_CONTEO = { abierto: 'Abierto', cerrado: 'Cerrado', anulado: 'Anulado' } as const;
export const TONO_DE_CONTEO = { abierto: 'info', cerrado: 'exito', anulado: 'neutro' } as const;

/** `N-AAAA`, como se nombra un inventario físico en pantalla. */
export const codigoDeConteo = (c: Pick<ConteoDto, 'numero' | 'anio'>): string => `IF-${String(c.numero).padStart(4, '0')}-${c.anio}`;

/** Cuántas líneas faltan por contar, y si hay algo que cerrar. */
export const avanceDeConteo = (c: Pick<ConteoDto, 'totalLineas' | 'lineasContadas'>) => ({
  faltan: c.totalLineas - c.lineasContadas,
  puedeCerrar: c.lineasContadas > 0,
  texto: `${c.lineasContadas} de ${c.totalLineas} contados`,
});

/** Lo tecleado por artículo (milésimas o nulo) → solo las líneas que cambiaron respecto de lo guardado. */
export function cambiosDeConteo(guardado: ConteoDto['lineas'], tecleado: ReadonlyMap<string, number | null>): Array<{ articuloId: string; contadaMilesimas: number }> {
  return guardado.flatMap((l) => {
    const t = tecleado.get(l.articuloId);
    return t === undefined || t === null || t === l.contadaMilesimas ? [] : [{ articuloId: l.articuloId, contadaMilesimas: t }];
  });
}
