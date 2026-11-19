import { describe, expect, it } from 'vitest';
import { tarjetasDeInsumos, textoDeCantidad, type ExistenciaBajoMinimo } from './pendientes.js';

const fila = (o: Partial<ExistenciaBajoMinimo> & { id: string }): ExistenciaBajoMinimo => ({ nombre: 'Papel bond', unidad: 'resma', minimoMilesimas: 10_000, cantidadMilesimas: 2_500, sucursal: 'Principal', ...o });

describe('insumos pendientes', () => {
  it('textoDeCantidad', () => {
    expect([12_000, 2_500, 125, 0].map(textoDeCantidad)).toEqual(['12', '2,5', '0,125', '0']);
  });
  it('bajo mínimo: prioridad baja (info), dice en qué sucursal y lleva a su ficha', () => {
    const [a, b] = tarjetasDeInsumos([fila({ id: 'a1' }), fila({ id: 'a2', nombre: 'Tinta', unidad: 'litro', minimoMilesimas: 5_000, cantidadMilesimas: 0 })]);
    expect(a).toMatchObject({ urgencia: 'info', grupo: 'inventario', detalle: 'Quedan 2,5 resma en Principal, el mínimo es 10', entidad: { tipo: 'articulo', id: 'a1' } });
    expect(b!.detalle).toBe('Sin existencias en Principal (mínimo 5 litro)');
  });
  it('el mínimo vale por sucursal: una tarjeta por artículo con la sucursal más corta y cuántas más faltan', () => {
    const r = tarjetasDeInsumos([fila({ id: 'a1', sucursal: 'Centro', cantidadMilesimas: 1_000 }), fila({ id: 'a1', sucursal: 'Norte', cantidadMilesimas: 4_000 }), fila({ id: 'a1', sucursal: 'Sur', cantidadMilesimas: 9_000 })]);
    expect(r).toHaveLength(1);
    expect(r[0]!.detalle).toBe('Quedan 1 resma en Centro (y 2 sucursales más), el mínimo es 10');
  });
});
