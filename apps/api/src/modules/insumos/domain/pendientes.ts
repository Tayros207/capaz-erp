import type { TarjetaDePendiente } from '@capaz/shared';

// «Mi día» de insumos: puro. El mínimo de un artículo vale para cada sucursal (igual que la pantalla de alertas, el resumen
// del módulo y el aviso `existencia.bajo_minimo`): un artículo entra si en alguna sucursal quedó por debajo. Una tarjeta por
// artículo, con la sucursal más corta; prioridad baja (al final).

/** Una existencia (artículo en una sucursal) por debajo del mínimo. */
export type ExistenciaBajoMinimo = { id: string; nombre: string; unidad: string; minimoMilesimas: number; cantidadMilesimas: number; sucursal: string };

/** Milésimas como «12», «2,5» o «0,125» (sin ceros de sobra). */
export function textoDeCantidad(milesimas: number): string {
  const entero = Math.trunc(milesimas / 1000);
  const resto = Math.abs(milesimas % 1000);
  return resto === 0 ? String(entero) : `${entero},${String(resto).padStart(3, '0').replace(/0+$/, '')}`;
}

/** Agrupa por artículo conservando el orden de llegada (la más corta primero). */
export function agruparPorArticulo(filas: readonly ExistenciaBajoMinimo[]): Array<{ peor: ExistenciaBajoMinimo; sucursales: number }> {
  const porArticulo = new Map<string, { peor: ExistenciaBajoMinimo; sucursales: number }>();
  for (const f of filas) {
    const actual = porArticulo.get(f.id);
    if (actual) actual.sucursales += 1;
    else porArticulo.set(f.id, { peor: f, sucursales: 1 });
  }
  return [...porArticulo.values()];
}

function detalleDe(a: ExistenciaBajoMinimo, sucursales: number): string {
  const donde = sucursales > 1 ? `en ${a.sucursal} (y ${sucursales - 1} ${sucursales === 2 ? 'sucursal más' : 'sucursales más'})` : `en ${a.sucursal}`;
  return a.cantidadMilesimas <= 0
    ? `Sin existencias ${donde} (mínimo ${textoDeCantidad(a.minimoMilesimas)} ${a.unidad})`
    : `Quedan ${textoDeCantidad(a.cantidadMilesimas)} ${a.unidad} ${donde}, el mínimo es ${textoDeCantidad(a.minimoMilesimas)}`;
}

export function tarjetasDeInsumos(filas: readonly ExistenciaBajoMinimo[]): TarjetaDePendiente[] {
  return agruparPorArticulo(filas).map(({ peor: a, sucursales }) => ({
    clave: `articulo:${a.id}`,
    grupo: 'inventario',
    urgencia: 'info',
    titulo: a.nombre,
    detalle: detalleDe(a, sucursales),
    fecha: null,
    montoCentimos: null,
    cliente: null,
    entidad: { tipo: 'articulo', id: a.id, codigo: a.nombre },
    acciones: [],
    mensaje: null,
    cobro: null,
  }));
}
