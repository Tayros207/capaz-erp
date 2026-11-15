import { describe, expect, it } from 'vitest';
import { prepararProducto } from './producto.js';

describe('prepararProducto', () => {
  it('normaliza nombre, código y valores por defecto', () => {
    expect(prepararProducto({ nombre: ' Polo  Básico ', tipo: 'producto', codigo: ' pol-01 ' })).toEqual({
      ok: true,
      datos: { codigo: 'POL-01', nombre: 'Polo Básico', nombreNormalizado: 'polo basico', tipo: 'producto', unidad: 'unidad', precioUnitarioMilesimas: 0, afectoIgv: true, descripcion: null },
    });
  });
  it('el precio es entero de milésimas y no negativo', () => {
    expect(prepararProducto({ nombre: 'a', tipo: 'servicio', precioUnitarioMilesimas: 12500 }).ok).toBe(true);
    expect(prepararProducto({ nombre: 'a', tipo: 'servicio', precioUnitarioMilesimas: 1.5 })).toMatchObject({ ok: false, campo: 'precioUnitarioMilesimas' });
    expect(prepararProducto({ nombre: 'a', tipo: 'servicio', precioUnitarioMilesimas: -1 })).toMatchObject({ ok: false });
  });
  it('rechaza nombre vacío y código con caracteres raros', () => {
    expect(prepararProducto({ nombre: ' ', tipo: 'producto' })).toMatchObject({ ok: false, campo: 'nombre' });
    expect(prepararProducto({ nombre: 'a', tipo: 'producto', codigo: 'a b!' })).toMatchObject({ ok: false, campo: 'codigo' });
  });
});
