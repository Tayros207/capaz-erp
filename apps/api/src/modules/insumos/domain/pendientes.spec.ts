import { describe, expect, it } from 'vitest';
import { tarjetasDeInsumos, textoDeCantidad } from './pendientes.js';

describe('insumos pendientes', () => {
  it('textoDeCantidad', () => {
    expect([12_000, 2_500, 125, 0].map(textoDeCantidad)).toEqual(['12', '2,5', '0,125', '0']);
  });
  it('bajo mínimo: prioridad baja (info) y a su ficha', () => {
    const [a, b] = tarjetasDeInsumos([{ id: 'a1', nombre: 'Papel bond', unidad: 'resma', minimoMilesimas: 10_000, cantidadMilesimas: 2_500 }, { id: 'a2', nombre: 'Tinta', unidad: 'litro', minimoMilesimas: 5_000, cantidadMilesimas: 0 }]);
    expect(a).toMatchObject({ urgencia: 'info', grupo: 'inventario', detalle: 'Quedan 2,5 resma, el mínimo es 10', entidad: { tipo: 'articulo', id: 'a1' } });
    expect(b!.detalle).toBe('Sin existencias (mínimo 5 litro)');
  });
});
