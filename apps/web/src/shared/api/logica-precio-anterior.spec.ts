import { describe, expect, it } from 'vitest';
import { baseMostrada, diaATexto, milesimasATextoPlano, precioParaUsar, puedeSugerir, rutaDelDocumento, unidadAlUsar } from './logica-precio-anterior.ts';

describe('unidadAlUsar', () => {
  it('copia la unidad del precio anterior mientras la persona no eligió una', () => {
    expect(unidadAlUsar('unidad', false, 'millar')).toBe('millar');
  });
  it('respeta la unidad que la persona eligió', () => {
    expect(unidadAlUsar('ciento', true, 'millar')).toBe('ciento');
  });
  it('sin unidad en el precio anterior, deja la de la fila', () => {
    expect(unidadAlUsar('unidad', false, '  ')).toBe('unidad');
  });
});

const pedido = { baseDePrecio: 'con_igv', precioUnitarioMilesimas: 118_000, precioConIgvMilesimas: 118_000, precioSinIgvMilesimas: 100_000 } as const;
const cotizado = { baseDePrecio: 'sin_igv', precioUnitarioMilesimas: 100_000, precioConIgvMilesimas: 118_000, precioSinIgvMilesimas: 100_000 } as const;
const ot = { baseDePrecio: 'sin_desglose', precioUnitarioMilesimas: 15_000, precioConIgvMilesimas: null, precioSinIgvMilesimas: null } as const;

describe('puedeSugerir', () => {
  it('pide cliente y (producto o 3 letras)', () => {
    expect(puedeSugerir(null, 'p', 'caja')).toBe(false);
    expect(puedeSugerir('c', null, 'ca')).toBe(false);
    expect(puedeSugerir('c', null, '  caj ')).toBe(true);
    expect(puedeSugerir('c', 'p', '')).toBe(true);
  });
});

describe('precioParaUsar y baseMostrada', () => {
  it('toma el precio en la base con la que se trabaja', () => {
    expect(precioParaUsar(pedido, true)).toBe(118_000);
    expect(precioParaUsar(pedido, false)).toBe(100_000);
    expect(precioParaUsar(cotizado, true)).toBe(118_000);
    expect(precioParaUsar(cotizado, false)).toBe(100_000);
  });
  it('una orden de trabajo se usa tal cual, sin convertir', () => {
    expect(precioParaUsar(ot, true)).toBe(15_000);
    expect(precioParaUsar(ot, false)).toBe(15_000);
    expect(baseMostrada(ot, true)).toBe('precio final acordado');
    expect(baseMostrada(pedido, false)).toBe('sin IGV');
    expect(baseMostrada(pedido, true)).toBe('con IGV');
  });
});

describe('formato', () => {
  it('día sin pasar por zona horaria', () => {
    expect(diaATexto('2026-05-10')).toBe('10/05/2026');
    expect(diaATexto('ayer')).toBe('—');
  });
  it('milésimas a texto plano', () => {
    expect(milesimasATextoPlano(118_000)).toBe('118');
    expect(milesimasATextoPlano(240)).toBe('0.24');
    expect(milesimasATextoPlano(12_505)).toBe('12.505');
    expect(milesimasATextoPlano(1_234_500)).toBe('1234.5');
  });
  it('ruta del documento por fuente', () => {
    expect(rutaDelDocumento({ fuente: 'pedido', documento: { id: 'a', codigo: '', estado: '', fecha: '' } })).toBe('/m/ordenes/a');
    expect(rutaDelDocumento({ fuente: 'cotizacion', documento: { id: 'b', codigo: '', estado: '', fecha: '' } })).toBe('/m/cotizador/cotizaciones/b');
    expect(rutaDelDocumento({ fuente: 'orden_trabajo', documento: { id: 'c', codigo: '', estado: '', fecha: '' } })).toBe('/m/produccion/c');
  });
});
