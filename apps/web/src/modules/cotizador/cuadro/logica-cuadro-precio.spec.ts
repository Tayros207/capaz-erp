import { describe, expect, it } from 'vitest';
import { centimosSchema } from '@capaz/shared';
import type { FilaDirecta, Vista } from './logica-cuadro.ts';
import {
  REFERENCIAS_VACIAS, argumentosDeBaseDeUtilidad, argumentosDeCelda, argumentosDeDescuento, argumentosDeFija, argumentosDeItemNuevo, argumentosDeReferencias, argumentosDeUtilidad,
  columnasAlAlternar, validarItemDelCuadro, ITEM_NUEVO,
} from './logica-cuadro-precio.ts';

const ID = '0192f0c4-7b1e-7000-8000-000000000001';
const fila = { clave: 'k1', nombre: 'Diseño', esItem: false, factor: 'diseno', fija: false } as unknown as FilaDirecta;
const col = (seEnvia: boolean) => ({ seEnvia });
const vista = { directo: { columnas: { '100': col(true), '1000': col(false), '5000': col(true) } } } as unknown as Vista;

describe('cuadro directo', () => {
  it('una celda lleva el importe en céntimos o null para vaciarla; la fila fija va aparte', () => {
    expect(argumentosDeCelda(ID, fila, '1000', 4000)).toEqual({ id: ID, celdas: [{ fila: 'k1', columna: '1000', importeCentimos: 4000 }] });
    expect(argumentosDeCelda(ID, fila, '100', null).celdas?.[0]?.importeCentimos).toBeNull();
    expect(argumentosDeFija(ID, fila, true)).toEqual({ id: ID, fijas: [{ fila: 'k1', fija: true }] });
  });
  it('las columnas a enviar conservan el orden y nunca quedan vacías', () => {
    expect(columnasAlAlternar(vista, '1000', true)).toEqual(['100', '1000', '5000']);
    expect(columnasAlAlternar(vista, '100', false)).toEqual(['5000']);
    const una = { directo: { columnas: { '100': col(true), '1000': col(false), '5000': col(false) } } } as unknown as Vista;
    expect(columnasAlAlternar(una, '100', false)).toBeNull();
  });
});

describe('utilidad y precio final', () => {
  it('valida el porcentaje y lo manda con punto', () => {
    expect(argumentosDeUtilidad(ID, '35,5')).toEqual({ args: { id: ID, pct: '35.5' } });
    expect(argumentosDeUtilidad(ID, '20', '5000')).toEqual({ args: { id: ID, pct: '20', columna: '5000' } });
    expect(argumentosDeUtilidad(ID, 'x')).toEqual({ error: 'Escribe un porcentaje con hasta 3 decimales.' });
    expect(argumentosDeBaseDeUtilidad(ID, 'costo')).toEqual({ id: ID, base: 'costo' });
  });
  it('el descuento es una sola cosa: un porcentaje', () => {
    expect(argumentosDeDescuento(ID, '10')).toEqual({ args: { id: ID, descuentoPct: '10' } });
    expect(argumentosDeDescuento(ID, '')).toHaveProperty('error');
  });
});

describe('ítems y referencias', () => {
  it('un ítem pide nombre y puede guardarse en el taller', () => {
    expect(validarItemDelCuadro(ITEM_NUEVO)).toEqual({ nombre: 'Falta el nombre del ítem.' });
    expect(argumentosDeItemNuevo(ID, { nombre: ' Troquel ', factor: 'acabado', fija: true, guardarEnTaller: true })).toEqual({ id: ID, nombre: 'Troquel', factor: 'acabado', fija: true, guardarEnTaller: true });
  });
  it('guardar referencias omite lo que está vacío', () => {
    expect(argumentosDeReferencias(ID, REFERENCIAS_VACIAS)).toEqual({ id: ID, modoIntermedio: 'curva', confirmarUnitarioNoBaja: false });
    expect(argumentosDeReferencias(ID, { nombre: ' Volantes ', productoId: ID, modo: 'escalon', minimoCentimos: centimosSchema.parse(20_000), confirmarUnitarioNoBaja: true }))
      .toEqual({ id: ID, nombre: 'Volantes', productoId: ID, modoIntermedio: 'escalon', precioMinimoCentimos: 20_000, confirmarUnitarioNoBaja: true });
  });
});
