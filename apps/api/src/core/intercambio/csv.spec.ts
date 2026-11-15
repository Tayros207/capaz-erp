import { describe, expect, it } from 'vitest';
import { detectarSeparador, escribirCsv, leerCsv, protegerCelda } from './csv.js';

const leer = (t: string, o: { separador?: ',' | ';' | 'auto'; maxFilas?: number } = {}) => {
  const r = leerCsv(t, { maxFilas: 1000, ...o });
  if (!r.ok) throw new Error(r.motivo);
  return r;
};

describe('leerCsv', () => {
  it('lee filas simples con \\n, \\r\\n y \\r', () => {
    for (const fin of ['\n', '\r\n', '\r']) {
      const r = leer(`a,b${fin}1,2${fin}3,4`);
      expect(r.filas.map((f) => f.celdas)).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
    }
  });

  it('admite comillas, comas, comillas escapadas y saltos de línea dentro del campo', () => {
    const r = leer('nombre,nota\n"Pérez, José","dijo ""hola""\nadiós"\nAna,');
    expect(r.filas[1]!.celdas).toEqual(['Pérez, José', 'dijo "hola"\nadiós']);
    expect(r.filas[2]).toEqual({ numero: 4, celdas: ['Ana', ''] });
  });

  it('quita el BOM y detecta el punto y coma', () => {
    const r = leer('﻿nombre;telefono\nAna;999');
    expect(r.separador).toBe(';');
    expect(r.filas[0]!.celdas).toEqual(['nombre', 'telefono']);
    expect(detectarSeparador('a,b;c,d')).toBe(',');
    expect(detectarSeparador('"a;b;c",d')).toBe(',');
  });

  it('omite las filas vacías pero conserva la numeración', () => {
    const r = leer('a\n\n\nb\n');
    expect(r.filas).toEqual([{ numero: 1, celdas: ['a'] }, { numero: 4, celdas: ['b'] }]);
  });

  it('un campo vacío entre comillas no es una fila vacía', () => {
    expect(leer('a,b\n""').filas).toHaveLength(2);
  });

  it('rechaza comillas sin cerrar, texto tras comillas y comillas en medio', () => {
    expect(leerCsv('a\n"b', { maxFilas: 10 })).toMatchObject({ ok: false });
    expect(leerCsv('a\n"b"x', { maxFilas: 10 })).toMatchObject({ ok: false });
    expect(leerCsv('a\nb"c"', { maxFilas: 10 })).toMatchObject({ ok: false });
  });

  it('respeta el máximo de filas de datos', () => {
    expect(leerCsv('h\n1\n2\n3', { maxFilas: 3 }).ok).toBe(true);
    const r = leerCsv('h\n1\n2\n3\n4', { maxFilas: 3 });
    expect(r).toMatchObject({ ok: false });
  });
});

describe('escribirCsv', () => {
  it('cita lo que lleva separador, comillas o saltos y termina cada fila con \\r\\n', () => {
    const t = escribirCsv([['a', 'b,c'], ['d"e', 'f\ng']], { separador: ',' });
    expect(t).toBe('a,"b,c"\r\n"d""e","f\ng"\r\n');
  });

  it('usa el separador pedido y el BOM', () => {
    expect(escribirCsv([['a;b', 'c,d']], { separador: ';', bom: true })).toBe('﻿"a;b";c,d\r\n');
  });

  it('prefija con comilla simple las celdas que parecen fórmulas', () => {
    for (const f of ['=1+1', '+5', '-2', '@SUMA(A1)', '\tx', '\rx']) expect(protegerCelda(f)).toBe(`'${f}`);
    expect(protegerCelda('normal=1')).toBe('normal=1');
    expect(escribirCsv([['=HYPERLINK("x")']], { separador: ',' })).toBe('"\'=HYPERLINK(""x"")"\r\n');
  });

  it('lo escrito se lee igual', () => {
    const filas = [['nombre', 'nota'], ['Ñandú, "el" grande', 'línea 1\nlínea 2'], ['', 'x;y']];
    for (const separador of [',', ';'] as const) {
      const r = leer(escribirCsv(filas, { separador, bom: true }), { separador: 'auto' });
      expect(r.filas.map((f) => f.celdas)).toEqual(filas);
    }
  });
});
