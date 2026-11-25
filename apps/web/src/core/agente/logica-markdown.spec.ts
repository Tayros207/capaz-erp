import { describe, expect, it } from 'vitest';
import { bloquesDe, tramosDe } from './logica-markdown.ts';

describe('tramosDe', () => {
  it('separa negrita, cursiva y código del texto normal', () => {
    expect(tramosDe('Total **S/ 180.00** con `IGV` y *sin* más')).toEqual([
      { tipo: 'texto', texto: 'Total ' }, { tipo: 'negrita', texto: 'S/ 180.00' }, { tipo: 'texto', texto: ' con ' }, { tipo: 'codigo', texto: 'IGV' },
      { tipo: 'texto', texto: ' y ' }, { tipo: 'cursiva', texto: 'sin' }, { tipo: 'texto', texto: ' más' },
    ]);
  });
  it('un formato que todavía no cerró (llega por partes) se queda como texto, sin romper nada', () => {
    expect(tramosDe('Hecho **a medi')).toEqual([{ tipo: 'texto', texto: 'Hecho **a medi' }]);
  });
  it('los asteriscos de una cuenta no son cursiva', () => {
    expect(tramosDe('2 * 3 * 4')).toEqual([{ tipo: 'texto', texto: '2 * 3 * 4' }]);
  });
  it('no hay enlaces ni imágenes ni HTML: se muestran como el texto que son', () => {
    const t = tramosDe('[clic](https://malo.example) <img src=x onerror=alert(1)>');
    expect(t.every((x) => x.tipo === 'texto')).toBe(true);
    expect(t.map((x) => x.texto).join('')).toBe('[clic](https://malo.example) <img src=x onerror=alert(1)>');
  });
});

describe('bloquesDe', () => {
  it('una línea en blanco separa párrafos y las líneas seguidas se quedan juntas', () => {
    const b = bloquesDe('Primera\nsigue\n\nSegunda');
    expect(b).toHaveLength(2);
    expect(b[0]).toMatchObject({ tipo: 'parrafo' });
    expect((b[0] as { lineas: unknown[] }).lineas).toHaveLength(2);
  });
  it('las viñetas y los números abren listas, y cambiar de tipo abre otra', () => {
    const b = bloquesDe('Pedidos:\n- Uno\n- **Dos**\n1. A\n2. B');
    expect(b.map((x) => x.tipo)).toEqual(['parrafo', 'lista', 'lista']);
    expect(b[1]).toMatchObject({ ordenada: false });
    expect((b[1] as { items: unknown[] }).items).toHaveLength(2);
    expect(b[2]).toMatchObject({ ordenada: true });
  });
  it('un «# Título» se vuelve una línea en negrita, no un título enorme', () => {
    expect(bloquesDe('## Resumen')).toEqual([{ tipo: 'parrafo', lineas: [[{ tipo: 'negrita', texto: 'Resumen' }]] }]);
  });
  it('texto vacío no da bloques; saltos de línea de Windows se entienden', () => {
    expect(bloquesDe('')).toEqual([]);
    expect(bloquesDe('a\r\n\r\nb')).toHaveLength(2);
  });
});
