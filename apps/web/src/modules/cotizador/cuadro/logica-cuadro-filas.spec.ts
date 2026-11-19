import { describe, expect, it } from 'vitest';
import type { TarifaDelTallerDto } from '@capaz/shared';
import type { Vista } from './logica-cuadro.ts';
import { FILA_VACIA, argumentosDeFilaNueva, cambioDeMedida, cambioDeTrabajo, cambiosDeFila, formularioDeFila, medidasDeTexto, validarFila } from './logica-cuadro-filas.ts';

const ID = '0192f0c4-7b1e-7000-8000-000000000001';
const vista = {
  trabajo: { producto: 'Volantes', cantidad: '2500', pieza: { anchoCm: '14.80', altoCm: '21.00' }, tintas: 4, caras: 2, cliente: '' },
  imposicion: { parametros: { sangradoCm: '0.30', calleCm: null, pinzaCm: null } },
} as unknown as Vista;
const tarifa = { id: ID, nombre: 'Corte' } as TarifaDelTallerDto;

describe('filas del cuadro', () => {
  it('desde una tarifa solo hace falta la cantidad; a mano, descripción, unidad y costo', () => {
    expect(validarFila({ ...FILA_VACIA, cantidad: '2' }, false, true)).toEqual({ tarifa: 'Elige una tarifa o escribe la fila a mano.' });
    expect(validarFila({ ...FILA_VACIA, tarifa, cantidad: '2' }, false, true)).toEqual({});
    expect(validarFila({ ...FILA_VACIA, cantidad: '0.5555' }, true, true)).toMatchObject({ cantidad: expect.any(String), descripcion: expect.any(String), costoUnitario: 'Falta el costo.' });
    expect(validarFila({ ...FILA_VACIA, descripcion: 'x', cantidad: '1', costoUnitario: '0,5' }, true, true)).toEqual({});
    expect(validarFila({ ...FILA_VACIA, descripcion: 'x' }, true, false)).toEqual({});
  });
  it('arma los argumentos con la tarifa o a mano, con punto decimal', () => {
    expect(argumentosDeFilaNueva(ID, { ...FILA_VACIA, tarifa, cantidad: '2,5' }, false)).toEqual({ id: ID, tarifaId: ID, cantidad: '2.5' });
    expect(argumentosDeFilaNueva(ID, { ...FILA_VACIA, factor: 'acabado', descripcion: ' Corte ', cantidad: '1', unidad: 'lote', costoUnitario: '0,5', escala: 'fija' }, true))
      .toEqual({ id: ID, factor: 'acabado', descripcion: 'Corte', cantidad: '1', unidad: 'lote', costoUnitario: '0.5', escala: 'fija' });
  });
  it('al editar solo envía los campos que cambiaron', () => {
    const original = formularioDeFila({ id: 'f', numero: 1, factor: 'acabado', descripcion: 'Corte', cantidad: '1.000', unidad: 'lote', escala: 'fija', automatica: null, interno: { costoUnitario: '0.5000', subtotalCentimos: 50 } });
    expect(original).toMatchObject({ cantidad: '1', costoUnitario: '0.5' });
    expect(cambiosDeFila(original, original, true)).toEqual([]);
    expect(cambiosDeFila(original, { ...original, cantidad: '3', costoUnitario: '0,75', escala: 'por_pliego' }, true)).toEqual([
      { campo: 'cantidad', valor: '3' }, { campo: 'costoUnitario', valor: '0.75' }, { campo: 'escala', valor: 'por_pliego' },
    ]);
    expect(cambiosDeFila(original, { ...original, costoUnitario: '9' }, false)).toEqual([]);
  });
});

describe('trabajo e imposición', () => {
  it('no llama al servidor si el campo no cambió', () => {
    expect(cambioDeTrabajo(vista, ID, 'producto', 'Volantes')).toBeNull();
    expect(cambioDeTrabajo(vista, ID, 'cantidad', '2500')).toBeNull();
    expect(cambioDeTrabajo(vista, ID, 'tintas', '4')).toBeNull();
  });
  it('arma el cambio o devuelve el error de lo tecleado', () => {
    expect(cambioDeTrabajo(vista, ID, 'cantidad', '1.000,5')).toEqual({ error: 'Escribe una cantidad con hasta 3 decimales.' });
    expect(cambioDeTrabajo(vista, ID, 'cantidad', '1000')).toEqual({ args: { id: ID, cantidad: '1000' } });
    expect(cambioDeTrabajo(vista, ID, 'tintas', '13')).toEqual({ error: 'Las tintas van de 0 a 12.' });
    expect(cambioDeTrabajo(vista, ID, 'caras', '2')).toBeNull();
    expect(cambioDeTrabajo(vista, ID, 'anchoCm', '10,5')).toEqual({ args: { id: ID, pieza: { anchoCm: '10.5', altoCm: '21.00' } } });
  });
  it('sin pieza guardada, la primera medida espera a la otra y no es un error', () => {
    const sinPieza = { ...vista, trabajo: { ...vista.trabajo, pieza: null } } as unknown as Vista;
    expect(cambioDeTrabajo(sinPieza, ID, 'anchoCm', '10,5')).toEqual({ pendiente: { campo: 'anchoCm', valor: '10.5' } });
    expect(cambioDeTrabajo(sinPieza, ID, 'altoCm', '21', { anchoCm: '10.5' })).toEqual({ args: { id: ID, pieza: { anchoCm: '10.5', altoCm: '21' } } });
    expect(cambioDeTrabajo(sinPieza, ID, 'anchoCm', 'abc')).toEqual({ error: 'Escribe una medida con hasta 2 decimales.' });
  });
  it('las medidas de la imposición se comparan con lo guardado', () => {
    expect(cambioDeMedida(vista, ID, 'sangradoCm', '0.30')).toBeNull();
    expect(cambioDeMedida(vista, ID, 'calleCm', '0,5')).toEqual({ args: { id: ID, calleCm: '0.5' } });
    expect(cambioDeMedida(vista, ID, 'pinzaCm', 'abc')).toEqual({ error: 'Escribe una medida con hasta 2 decimales.' });
  });
});

describe('pliego tecleado a mano', () => {
  it('entiende las formas habituales de escribir una medida', () => {
    for (const t of ['70x100', '70X100', '70 x 100', '70×100', '70*100', '70 por 100', '70 x 100 cm']) expect(medidasDeTexto(t), t).toEqual({ anchoCm: '70', altoCm: '100' });
    expect(medidasDeTexto('64,5 x 90.25')).toEqual({ anchoCm: '64.5', altoCm: '90.25' });
  });
  it('rechaza lo que no es una medida', () => {
    for (const t of ['', 'GTO', '70', '70x', 'x100', '0x100', '70x100x5', '70.123x100']) expect(medidasDeTexto(t), t).toBeNull();
  });
});
