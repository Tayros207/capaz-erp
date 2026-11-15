import { describe, expect, it } from 'vitest';
import type { ProductoDto } from '@capaz/shared';
import {
  argumentosDeCreacion,
  argumentosDeEdicion,
  formatearPrecio,
  formularioDesde,
  FORMULARIO_VACIO,
  milesimasATexto,
  textoAMilesimas,
  validarProducto,
} from './logica.ts';

const PRODUCTO: ProductoDto = {
  id: '5b2f1a5e-0c1d-4a8e-9a53-3f6a8c2d9e10',
  codigo: 'TAZ-01',
  nombre: 'Taza sublimada',
  tipo: 'producto',
  unidad: 'UND',
  precioUnitarioMilesimas: 12500,
  afectoIgv: true,
  descripcion: null,
  archivadoEn: null,
  creadoEn: '2026-11-10T10:00:00.000Z',
  actualizadoEn: '2026-11-10T10:00:00.000Z',
};

describe('precio en milésimas', () => {
  it('convierte lo escrito en soles', () => {
    expect(textoAMilesimas('12.50')).toBe(12500);
    expect(textoAMilesimas('S/ 1,234.5')).toBe(1234500);
    expect(textoAMilesimas('0.005')).toBe(5);
    expect(textoAMilesimas('7')).toBe(7000);
  });
  it('rechaza lo que no es precio', () => {
    expect(textoAMilesimas('')).toBeNull();
    expect(textoAMilesimas('-3')).toBeNull();
    expect(textoAMilesimas('1.2345')).toBeNull();
    expect(textoAMilesimas('abc')).toBeNull();
  });
  it('lo muestra con dos decimales, o tres si hacen falta', () => {
    expect(milesimasATexto(12500)).toBe('12.50');
    expect(milesimasATexto(12505)).toBe('12.505');
    expect(milesimasATexto(0)).toBe('0.00');
    expect(formatearPrecio(1234500)).toBe('S/ 1,234.50');
  });
});

describe('formulario de producto', () => {
  it('exige nombre y precio válido', () => {
    expect(validarProducto(FORMULARIO_VACIO).nombre).toBeDefined();
    expect(validarProducto({ ...FORMULARIO_VACIO, nombre: 'X', precio: 'x' }).precio).toBeDefined();
    expect(validarProducto({ ...FORMULARIO_VACIO, nombre: 'X', precio: '' })).toEqual({});
  });
  it('al crear omite lo vacío', () => {
    expect(argumentosDeCreacion({ ...FORMULARIO_VACIO, nombre: ' Taza ', precio: '12.50' })).toEqual({
      tipo: 'producto',
      nombre: 'Taza',
      afectoIgv: true,
      precioUnitarioMilesimas: 12500,
    });
  });
  it('al editar manda solo lo que cambió', () => {
    expect(argumentosDeEdicion(PRODUCTO, formularioDesde(PRODUCTO))).toBeNull();
    const f = { ...formularioDesde(PRODUCTO), precio: '15', codigo: '' };
    expect(argumentosDeEdicion(PRODUCTO, f)).toEqual({ id: PRODUCTO.id, codigo: null, precioUnitarioMilesimas: 15000 });
  });
});
