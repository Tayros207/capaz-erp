import { describe, expect, it } from 'vitest';
import { limpiarDecimal, resumenDeCambioDeTarifa, validarFormato, validarItem, validarMaquina, validarTarifa } from './taller.js';
import { semillaDelTaller } from './taller-semilla.js';

describe('validaciones del taller con los esquemas del motor', () => {
  it('acepta un formato, una tarifa y un ítem correctos y rechaza medidas en cero', () => {
    expect(validarFormato({ nombre: '70 × 100', anchoCm: '70', altoCm: '100', tipo: 'madre' }).ok).toBe(true);
    expect(validarFormato({ nombre: 'x', anchoCm: '0', altoCm: '100', tipo: 'madre' }).ok).toBe(false);
    expect(validarTarifa({ factor: 'material', nombre: 'Papel', unidad: 'pliego', costoUnitario: '0.45', escalaPorDefecto: 'por_pliego' }).ok).toBe(true);
    expect(validarTarifa({ factor: 'material', nombre: 'Papel', unidad: 'pliego', costoUnitario: 'abc', escalaPorDefecto: 'por_pliego' }).ok).toBe(false);
    expect(validarItem({ nombre: 'Plastificado', factor: 'acabado', despuesDe: 'acabado', fija: false }).ok).toBe(true);
  });
  it('una máquina con merma de 100 % o sin nombre en la etapa no vale', () => {
    const base = { nombre: 'M', formatoMaxAnchoCm: '36', formatoMaxAltoCm: '52', pinzaCm: '2', sangradoCm: '0.3', calleCm: '0.3' };
    expect(validarMaquina({ ...base, etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }] }).ok).toBe(true);
    expect(validarMaquina({ ...base, etapas: [{ nombre: 'Tiraje', mermaPct: '100', arranque: '40' }] }).ok).toBe(false);
  });
});

describe('texto decimal', () => {
  it('quita ceros de relleno sin tocar enteros', () => {
    expect(limpiarDecimal('0.4500')).toBe('0.45');
    expect(limpiarDecimal('70.00')).toBe('70');
    expect(limpiarDecimal('100')).toBe('100');
    expect(limpiarDecimal('0.3000')).toBe('0.3');
  });
  it('el resumen dice el costo antes y después, o solo «datos» si no cambia', () => {
    expect(resumenDeCambioDeTarifa('Papel', '0.4500', '0.52')).toContain('Cambiarás el costo de «Papel»: 0.45 → 0.52');
    expect(resumenDeCambioDeTarifa('Papel', '0.4500', '0.45')).toBe('Cambiarás los datos de «Papel».');
  });
});

describe('semilla del taller', () => {
  it('trae 4 formatos, 1 máquina, 8 tarifas (una archivada) y 2 ítems en orden, todo válido', () => {
    const s = semillaDelTaller();
    expect([s.formatos.length, s.maquinas.length, s.tarifas.length, s.items.length]).toEqual([4, 1, 8, 2]);
    expect(s.tarifas.filter((t) => t.archivada)).toHaveLength(1);
    expect(s.items.map((i) => i.posicion)).toEqual([0, 1]);
    expect(s.formatos.every((f) => validarFormato(f).ok)).toBe(true);
    expect(s.maquinas.every((m) => validarMaquina(m).ok)).toBe(true);
    expect(s.tarifas.every((t) => validarTarifa(t).ok)).toBe(true);
    expect(new Set(s.tarifas.map((t) => t.nombreNormalizado)).size).toBe(8);
  });
});
