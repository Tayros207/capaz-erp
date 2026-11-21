import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineaDeMovimientoDto } from '@capaz/shared';
import { ProductosDelMovimiento } from './productos-del-movimiento.tsx';

const linea = (n: number, extra: Partial<LineaDeMovimientoDto> = {}): LineaDeMovimientoDto => ({
  id: `l${n}`, orden: n, productoId: null, descripcion: 'Etiquetas adhesivas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000, subtotalCentimos: 13_000, ...extra,
});

describe('ProductosDelMovimiento', () => {
  it('sin productos no pinta nada', () => {
    expect(renderToStaticMarkup(<ProductosDelMovimiento lineas={[]} />)).toBe('');
  });

  it('muestra cada producto con cantidad, precio y subtotal, y el total', () => {
    const h = renderToStaticMarkup(<ProductosDelMovimiento lineas={[linea(0), linea(1, { descripcion: 'Bolsas', unidad: 'unidad', cantidadMilesimas: 100_000, precioUnitarioMilesimas: 1_900, subtotalCentimos: 19_000 })]} />);
    expect(h).toContain('Etiquetas adhesivas');
    expect(h).toContain('Bolsas');
    expect(h).toContain('S/ 130.00');
    expect(h).toContain('S/ 190.00');
    expect(h).toContain('S/ 320.00');
    expect(h).toContain('aria-label="Productos"');
  });
});
