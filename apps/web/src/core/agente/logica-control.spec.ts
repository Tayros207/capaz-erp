import { describe, expect, it } from 'vitest';
import { etiquetaDePolitica, etiquetaDeResultado, formatoSoles, resumenDeArgumentos, solesACentimos, tituloDeHerramienta } from './logica-control.ts';

describe('logica-control', () => {
  it('los céntimos se muestran como soles sin usar decimales de number', () => {
    expect(formatoSoles(100_000)).toBe('S/ 1,000.00');
    expect(formatoSoles(5)).toBe('S/ 0.05');
    expect(formatoSoles(123_456)).toBe('S/ 1,234.56');
  });

  it('lo que la persona escribe en soles pasa a céntimos enteros, o es inválido', () => {
    expect(solesACentimos('1000')).toBe(100_000);
    expect(solesACentimos('1,000.5')).toBe(100_050);
    expect(solesACentimos(' 0.07 ')).toBe(7);
    for (const malo of ['', 'abc', '-5', '1.234', '1,0,0.999', '12.']) expect(solesACentimos(malo), malo).toBeNull();
  });

  it('las etiquetas dicen con palabras sencillas qué pasó y quién decide', () => {
    expect(etiquetaDeResultado('ok')).toBe('Hecho');
    expect(etiquetaDeResultado('rechazada')).toBe('No se pudo');
    expect(etiquetaDePolitica('propuesta')).toContain('persona');
  });

  it('los argumentos se resumen solo con valores simples y recortados', () => {
    expect(resumenDeArgumentos({ montoCentimos: 25_000, tipo: 'ingreso', lineas: [{ a: 1 }] })).toBe('montoCentimos: 25000 · tipo: ingreso');
    expect(resumenDeArgumentos(null)).toBe('');
    expect(resumenDeArgumentos({ x: 'y'.repeat(300) }, 50).length).toBe(50);
  });

  it('el nombre de una herramienta se lee como una frase corta', () => {
    expect(tituloDeHerramienta('movimiento_registrar')).toBe('Movimiento registrar');
  });
});
