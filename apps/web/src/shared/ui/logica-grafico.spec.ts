import { describe, expect, it } from 'vitest';
import { calcularEscala, categoriasDe, pasoDeEtiquetas, pasoRedondo, posicionY, sinDatos, valorEn } from './logica-grafico.ts';

const s = (...ys: number[]) => ({ nombre: 'a', puntos: ys.map((y, i) => ({ x: `m${i}`, y })) });

describe('pasoRedondo', () => {
  it('elige 1, 2, 2.5, 5 o 10 por potencia', () => {
    expect(pasoRedondo(100, 4)).toBe(25);
    expect(pasoRedondo(87, 4)).toBe(25);
    expect(pasoRedondo(40, 4)).toBe(10);
    expect(pasoRedondo(7, 4)).toBe(2);
    expect(pasoRedondo(0.9, 4)).toBeCloseTo(0.25);
  });
  it('rango no positivo: 1', () => expect(pasoRedondo(0, 4)).toBe(1));
});

describe('calcularEscala', () => {
  it('máximo redondeado hacia arriba con marcas parejas', () => {
    const e = calcularEscala([s(10, 87, 40)]);
    expect(e).toEqual({ min: 0, max: 100, marcas: [0, 25, 50, 75, 100] });
  });
  it('todo en cero o serie vacía: 0 a 1', () => {
    expect(calcularEscala([s(0, 0)])).toEqual({ min: 0, max: 1, marcas: [0, 1] });
    expect(calcularEscala([{ nombre: 'v', puntos: [] }])).toEqual({ min: 0, max: 1, marcas: [0, 1] });
    expect(calcularEscala([])).toEqual({ min: 0, max: 1, marcas: [0, 1] });
  });
  it('con negativos incluye el cero y baja el mínimo', () => {
    const e = calcularEscala([s(-30, 50)]);
    expect(e.min).toBe(-40);
    expect(e.max).toBe(60);
    expect(e.marcas).toContain(0);
  });
  it('solo negativos: el máximo es cero', () => {
    const e = calcularEscala([s(-10, -40)]);
    expect(e.max).toBe(0);
    expect(e.min).toBeLessThanOrEqual(-40);
  });
  it('usa el máximo de todas las series', () => {
    expect(calcularEscala([s(5), s(980)]).max).toBe(1000);
  });
  it('ignora valores no finitos', () => expect(calcularEscala([s(Number.NaN, 4)]).max).toBeGreaterThanOrEqual(4));
  it('valores pequeños con decimales sin ruido de coma flotante', () => {
    const e = calcularEscala([s(0.3)]);
    expect(e.marcas.every((m) => Number.isFinite(m) && String(m).length <= 6)).toBe(true);
    expect(e.max).toBeGreaterThanOrEqual(0.3);
  });
});

describe('posicionY', () => {
  const e = { min: -50, max: 50, marcas: [] };
  it('máximo arriba, mínimo abajo, cero al centro', () => {
    expect(posicionY(50, e, 100)).toBe(0);
    expect(posicionY(-50, e, 100)).toBe(100);
    expect(posicionY(0, e, 100)).toBe(50);
  });
});

describe('pasoDeEtiquetas', () => {
  it('todas si caben', () => expect(pasoDeEtiquetas(6, 400)).toBe(1));
  it('reduce si no caben', () => expect(pasoDeEtiquetas(12, 280)).toBe(3));
  it('casos límite', () => {
    expect(pasoDeEtiquetas(0, 100)).toBe(1);
    expect(pasoDeEtiquetas(5, 0)).toBe(5);
  });
});

describe('categorías y valores', () => {
  const a = { nombre: 'a', puntos: [{ x: 'ene', y: 1 }, { x: 'feb', y: 2 }] };
  const b = { nombre: 'b', puntos: [{ x: 'feb', y: 3 }, { x: 'mar', y: 4 }] };
  it('une categorías en orden de aparición', () => expect(categoriasDe([a, b])).toEqual(['ene', 'feb', 'mar']));
  it('valor faltante es null', () => {
    expect(valorEn(b, 'ene')).toBeNull();
    expect(valorEn(b, 'mar')).toBe(4);
  });
  it('sinDatos', () => {
    expect(sinDatos([{ nombre: 'x', puntos: [] }])).toBe(true);
    expect(sinDatos([a])).toBe(false);
  });
});
