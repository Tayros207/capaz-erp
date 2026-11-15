import { describe, expect, it } from 'vitest';
import { estadoDePaso, pestanaSegunTecla } from './logica-navegacion.ts';

describe('pestanaSegunTecla', () => {
  const sin = [false, false, false];
  it('avanza y retrocede con vuelta', () => {
    expect(pestanaSegunTecla('ArrowRight', 0, sin)).toBe(1);
    expect(pestanaSegunTecla('ArrowRight', 2, sin)).toBe(0);
    expect(pestanaSegunTecla('ArrowLeft', 0, sin)).toBe(2);
  });
  it('salta deshabilitadas', () => {
    expect(pestanaSegunTecla('ArrowRight', 0, [false, true, false])).toBe(2);
    expect(pestanaSegunTecla('Home', 1, [true, false, false])).toBe(1);
    expect(pestanaSegunTecla('End', 0, [false, false, true])).toBe(1);
  });
  it('ignora otras teclas y el caso sin opciones', () => {
    expect(pestanaSegunTecla('a', 0, sin)).toBeNull();
    expect(pestanaSegunTecla('ArrowRight', 0, [])).toBeNull();
    expect(pestanaSegunTecla('ArrowRight', 0, [true, true])).toBeNull();
  });
});

describe('estadoDePaso', () => {
  it('marca hecho, actual y pendiente', () => {
    expect([0, 1, 2].map((i) => estadoDePaso(i, 1))).toEqual(['hecho', 'actual', 'pendiente']);
  });
});
