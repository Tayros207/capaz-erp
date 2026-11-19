import type { TarjetaDePendiente } from '@capaz/shared';

// «Mi día» de insumos: puro. Los artículos cuya existencia total está bajo el mínimo, de prioridad baja (al final).

export type ArticuloBajoMinimo = { id: string; nombre: string; unidad: string; minimoMilesimas: number; cantidadMilesimas: number };

/** Milésimas como «12», «2,5» o «0,125» (sin ceros de sobra). */
export function textoDeCantidad(milesimas: number): string {
  const entero = Math.trunc(milesimas / 1000);
  const resto = Math.abs(milesimas % 1000);
  return resto === 0 ? String(entero) : `${entero},${String(resto).padStart(3, '0').replace(/0+$/, '')}`;
}

export function tarjetasDeInsumos(articulos: readonly ArticuloBajoMinimo[]): TarjetaDePendiente[] {
  return articulos.map((a) => ({
    clave: `articulo:${a.id}`,
    grupo: 'inventario',
    urgencia: 'info',
    titulo: a.nombre,
    detalle: a.cantidadMilesimas <= 0 ? `Sin existencias (mínimo ${textoDeCantidad(a.minimoMilesimas)} ${a.unidad})` : `Quedan ${textoDeCantidad(a.cantidadMilesimas)} ${a.unidad}, el mínimo es ${textoDeCantidad(a.minimoMilesimas)}`,
    fecha: null,
    montoCentimos: null,
    cliente: null,
    entidad: { tipo: 'articulo', id: a.id, codigo: a.nombre },
    acciones: [],
    mensaje: null,
    cobro: null,
  }));
}
