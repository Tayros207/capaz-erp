import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { filaConCantidad, filaDeCatalogo, filaDeProductoVacia } from './logica-lineas.ts';

vi.mock('./api.ts', () => ({ buscarProductosParaLinea: vi.fn(async () => []) }));
vi.mock('../../shared/ui/sugerencia-de-precio.tsx', () => ({ SugerenciaDePrecio: () => null }));
const { EditorDeProductos } = await import('./editor-de-productos.tsx');

const html = (filas: Parameters<typeof EditorDeProductos>[0]['filas'], extra: Record<string, unknown> = {}) => renderToStaticMarkup(<EditorDeProductos filas={filas} alCambiar={() => {}} {...extra} />);

describe('EditorDeProductos', () => {
  it('sin filas solo ofrece agregar', () => {
    const h = html([]);
    expect(h).toContain('Agregar productos');
  });

  it('una fila nueva pide elegir el producto, con la salida a «Otro producto»', () => {
    const h = html([filaDeProductoVacia('n1')]);
    expect(h).toContain('Producto 1');
    expect(h).toContain('Producto nuevo (escribir)');
    expect(h).toContain('Agregar otro producto');
  });

  it('una fila elegida muestra descripción, unidad, cantidad, precio e importe', () => {
    const f = filaConCantidad(filaDeCatalogo('a', { id: 'p1', nombre: 'Etiquetas', unidad: 'millar', precioUnitarioMilesimas: 65_000 }), 2000);
    const h = html([f]);
    expect(h).toContain('value="Etiquetas"');
    expect(h).toContain('Importe');
    expect(h).toContain('Quitar');
  });

  it('muestra el error general de los productos', () => {
    expect(html([filaDeProductoVacia('n1')], { error: 'Producto 1: Falta el precio.' })).toContain('Producto 1: Falta el precio.');
  });
});
