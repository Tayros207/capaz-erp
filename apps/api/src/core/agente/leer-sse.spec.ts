import { describe, expect, it } from 'vitest';
import { leerSse } from './leer-sse.js';

const flujo = (...trozos: string[]) => {
  const e = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const t of trozos) c.enqueue(e.encode(t));
      c.close();
    },
  });
};
const todo = async (f: ReadableStream<Uint8Array>) => {
  const salida: string[] = [];
  for await (const d of leerSse(f)) salida.push(d);
  return salida;
};

describe('leerSse', () => {
  it('entrega el texto de cada línea data', async () => {
    expect(await todo(flujo('data: uno\n\ndata: dos\n\n'))).toEqual(['uno', 'dos']);
  });

  it('salta los comentarios como «: OPENROUTER PROCESSING»', async () => {
    expect(await todo(flujo(': OPENROUTER PROCESSING\n\ndata: hola\n\n: otro\n\n'))).toEqual(['hola']);
  });

  it('aguanta que la red corte una línea por la mitad', async () => {
    expect(await todo(flujo('da', 'ta: ho', 'la\n\nda', 'ta: adios\n\n'))).toEqual(['hola', 'adios']);
  });

  it('aguanta saltos de línea de Windows y el último dato sin salto final', async () => {
    expect(await todo(flujo('data: a\r\n\r\ndata: b'))).toEqual(['a', 'b']);
  });

  it('un carácter acentuado partido entre dos trozos de bytes no se rompe', async () => {
    const bytes = new TextEncoder().encode('data: camión\n\n');
    const corte = bytes.indexOf(0xc3) + 1; // entre los dos bytes de «ó»
    const f = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(bytes.slice(0, corte));
        c.enqueue(bytes.slice(corte));
        c.close();
      },
    });
    expect(await todo(f)).toEqual(['camión']);
  });

  it('ignora las líneas que no son de datos y entrega [DONE] tal cual', async () => {
    expect(await todo(flujo('event: x\nid: 1\ndata: [DONE]\n\n'))).toEqual(['[DONE]']);
  });
});
