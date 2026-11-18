import { describe, expect, it } from 'vitest';
import {
  coincidenciaDeDescripcion,
  normalizarDescripcion,
  raicesDeBusqueda,
  similitudDeDescripciones as s,
} from './similitud-descripciones.js';

describe('normalizarDescripcion', () => {
  it('quita artículos, unidades y números sueltos; lleva el plural al singular', () => {
    expect(normalizarDescripcion('100 Cajas de bocaditos x millar')).toBe('caja bocadito');
  });
  it('conserva medidas y códigos con dígitos', () => {
    expect(normalizarDescripcion('Volantes A4 150 gr 20 x 20')).toBe('volant a4 150g 20x20');
  });
});

describe('similitudDeDescripciones', () => {
  it('la corta cabe entera en la larga: misma descripción', () => {
    expect(s('cajas de bocaditos', 'Caja de bocaditos surtidos')).toBeGreaterThanOrEqual(0.75);
    expect(s('volantes', 'Volantes A5 couché 150g')).toBeGreaterThanOrEqual(0.75);
  });
  it('es simétrica y el singular da lo mismo que el plural', () => {
    expect(s('sobres manila', 'sobre manila')).toBe(1);
    expect(s('a', 'b')).toBe(s('b', 'a'));
  });
  it('compara por sonido: b/v, c/s/z, h muda', () => {
    expect(s('Cabeza vinil', 'Kabesa binil')).toBeGreaterThanOrEqual(0.75);
    expect(s('hojas bond', 'ojas vond')).toBeGreaterThanOrEqual(0.75);
  });
  it('si no cabe, el parecido de letras tiene techo 0,74', () => {
    const v = s('tarjetas de presentacion', 'tarjetas de navidad');
    expect(v).toBeLessThanOrEqual(0.74);
  });
  it('productos distintos no se parecen', () => {
    expect(s('cajas de bocaditos', 'banner gigantografia')).toBeLessThan(0.55);
    expect(s('', 'volantes')).toBe(0);
    expect(s('100', 'volantes')).toBe(0);
  });
  it('una medida distinta no es la misma descripción', () => {
    expect(s('caja 20x20', 'caja 30x30')).toBeLessThan(0.75);
  });
});

describe('coincidenciaDeDescripcion', () => {
  it('cortes en 0,75 y 0,55', () => {
    expect(coincidenciaDeDescripcion(0.75)).toBe('misma_descripcion');
    expect(coincidenciaDeDescripcion(0.74)).toBe('parecida');
    expect(coincidenciaDeDescripcion(0.55)).toBe('parecida');
    expect(coincidenciaDeDescripcion(0.54)).toBeNull();
  });
});

describe('raicesDeBusqueda', () => {
  it('da el arranque escrito y el fonético, plegados', () => {
    const r = raicesDeBusqueda('Valverde cajas');
    expect(r).toContain('bal');
    expect(r).toContain('kaj');
  });
  it('respeta el máximo y no usa números sueltos', () => {
    expect(raicesDeBusqueda('100 200')).toEqual([]);
    expect(raicesDeBusqueda('uno dos tres cuatro cinco seis siete', 3, 3).length).toBeLessThanOrEqual(3);
  });
});
