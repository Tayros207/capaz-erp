import { describe, expect, it } from 'vitest';
import type { ItemDelCuadroDto, MaquinaDelTallerDto, TarifaDelTallerDto } from '@capaz/shared';
import {
  argumentosDeCreacionDeTarifa, argumentosDeEdicionDeItem, argumentosDeEdicionDeMaquina, argumentosDeEdicionDeTarifa, costoValido, formularioDeMaquina, formularioDeTarifa, limpiarEntrada,
  medidaValida, medidasDe, mostrarDecimal, ordenAlMover, resumenDeEtapas, soloLoCambiado, validarMaquina, validarTarifa, TARIFA_VACIA, MAQUINA_VACIA,
} from './logica-taller.ts';

const tarifa: TarifaDelTallerDto = {
  id: '0192f0c4-7b1e-7000-8000-000000000001', factor: 'material', nombre: 'Papel couché', unidad: 'pliego', costoUnitario: '0.4500', escalaPorDefecto: 'por_pliego',
  formatoId: null, articuloId: null, archivadoEn: null, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z',
};
const maquina: MaquinaDelTallerDto = {
  id: '0192f0c4-7b1e-7000-8000-000000000002', nombre: 'Offset', formatoMaxAnchoCm: '36.00', formatoMaxAltoCm: '52.00', pinzaCm: '2.00', sangradoCm: '0.30', calleCm: '0.30',
  etapas: [{ nombre: 'Tiraje', mermaPct: '3.000', arranque: '40' }], archivadoEn: null, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z',
};

describe('decimales como texto', () => {
  it('muestra sin ceros de relleno y acepta la coma al teclear', () => {
    expect(mostrarDecimal('0.4500')).toBe('0.45');
    expect(mostrarDecimal('70.00')).toBe('70');
    expect(mostrarDecimal('100')).toBe('100');
    expect(limpiarEntrada(' 0,45 ')).toBe('0.45');
    expect(medidasDe('70.00', '100.00')).toBe('70 × 100 cm');
  });
  it('valida medidas y costos sin convertir a número', () => {
    expect(medidaValida('0', false)).toBe('Debe ser mayor que cero.');
    expect(medidaValida('0', true)).toBeUndefined();
    expect(medidaValida('70,5', false)).toBeUndefined();
    expect(medidaValida('1.234', false)).toBeDefined();
    expect(medidaValida('', true)).toBe('Falta la medida.');
    expect(costoValido('0.4567')).toBeUndefined();
    expect(costoValido('0.45678')).toBeDefined();
    expect(costoValido('-1')).toBeDefined();
  });
});

describe('tarifas', () => {
  it('valida nombre, unidad y costo', () => {
    expect(validarTarifa(TARIFA_VACIA)).toEqual({ nombre: 'El nombre es obligatorio.', costoUnitario: 'Falta el costo.' });
    expect(validarTarifa({ ...TARIFA_VACIA, nombre: 'x', costoUnitario: '0,5' })).toEqual({});
  });
  it('crear envía el costo como texto con punto y el formato vacío como null', () => {
    expect(argumentosDeCreacionDeTarifa({ ...TARIFA_VACIA, nombre: ' Papel ', costoUnitario: '0,52' })).toEqual({
      factor: 'material', nombre: 'Papel', unidad: 'pliego', costoUnitario: '0.52', escalaPorDefecto: 'por_pliego', formatoId: null,
    });
  });
  it('editar envía solo lo cambiado y nada si no cambió: 0.4500 y 0.45 son lo mismo', () => {
    expect(argumentosDeEdicionDeTarifa(tarifa, formularioDeTarifa(tarifa))).toBeNull();
    expect(argumentosDeEdicionDeTarifa(tarifa, { ...formularioDeTarifa(tarifa), costoUnitario: '0.52' })).toEqual({ id: tarifa.id, costoUnitario: '0.52' });
  });
});

describe('máquinas', () => {
  it('exige medidas, y etapas con nombre, merma menor que 100 y hojas enteras', () => {
    const e = validarMaquina(MAQUINA_VACIA);
    expect(Object.keys(e).sort()).toEqual(['formatoMaxAltoCm', 'formatoMaxAnchoCm', 'nombre']);
    const base = { ...formularioDeMaquina(maquina) };
    expect(validarMaquina(base)).toEqual({});
    expect(validarMaquina({ ...base, etapas: [{ nombre: 'T', mermaPct: '100', arranque: '4' }] }).etapas).toBeDefined();
    expect(validarMaquina({ ...base, etapas: [{ nombre: 'T', mermaPct: '3', arranque: '4.5' }] }).etapas).toBeDefined();
  });
  it('editar sin cambios da null y con cambios envía solo el campo', () => {
    expect(argumentosDeEdicionDeMaquina(maquina, formularioDeMaquina(maquina))).toBeNull();
    expect(argumentosDeEdicionDeMaquina(maquina, { ...formularioDeMaquina(maquina), pinzaCm: '1,5' })).toEqual({ id: maquina.id, pinzaCm: '1.5' });
  });
  it('resume las etapas para la lista', () => {
    expect(resumenDeEtapas(maquina)).toBe('Tiraje 3 %');
    expect(resumenDeEtapas({ ...maquina, etapas: [] })).toBe('Sin etapas');
  });
});

describe('ítems y orden', () => {
  const item: ItemDelCuadroDto = { id: 'a', nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', posicion: 0, fija: false, archivadoEn: null, creadoEn: '', actualizadoEn: '' };
  it('editar un ítem envía solo lo cambiado', () => {
    expect(argumentosDeEdicionDeItem(item, { nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: true })).toEqual({ id: 'a', fija: true });
    expect(argumentosDeEdicionDeItem(item, { nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: false })).toBeNull();
  });
  it('mover sube o baja una posición y no sale de los bordes', () => {
    expect(ordenAlMover(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(ordenAlMover(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    expect(ordenAlMover(['a', 'b', 'c'], 0, -1)).toBeNull();
    expect(ordenAlMover(['a', 'b', 'c'], 2, 1)).toBeNull();
  });
  it('soloLoCambiado compara por valor', () => {
    expect(soloLoCambiado({ a: 1, b: [1] }, { a: 1, b: [1] })).toEqual({});
    expect(soloLoCambiado({ a: 1, b: [1] }, { a: 2, b: [1, 2] })).toEqual({ a: 2, b: [1, 2] });
  });
});
