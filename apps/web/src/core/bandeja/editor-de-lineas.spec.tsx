import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorDeLineas } from './editor-de-lineas.tsx';

describe('EditorDeLineas', () => {
  it('muestra la línea con sus valores en unidades legibles', () => {
    const html = renderToStaticMarkup(<EditorDeLineas lineasIniciales={[{ descripcion: 'tarjetas', unidad: 'unidad', cantidadMilesimas: 500000, precioUnitarioMilesimas: 365 }]} alCambiar={() => {}} />);
    for (const t of ['tarjetas', 'value="500"', 'value="0.365"', 'value="182.50"', 'Total (con IGV): S/ 182.50', 'Precio unitario (con IGV)', 'Subtotal']) expect(html).toContain(t);
    expect(html).not.toContain('cantidadMilesimas');
  });
  it('avisa cuando falta el precio', () => {
    const html = renderToStaticMarkup(<EditorDeLineas lineasIniciales={[{ descripcion: 'volantes', unidad: 'unidad', cantidadMilesimas: 500000 }]} alCambiar={() => {}} />);
    expect(html).toContain('Falta el precio.');
    expect(html).toContain('Completa los precios para ver el total.');
  });
});

describe('EditorDeLineas con ficha de máquina (W12)', () => {
  const base = { descripcion: 'tarjetas', unidad: 'unidad', cantidadMilesimas: 500000, precioUnitarioMilesimas: 365 };
  it('con ficha nace abierta con sus valores', () => {
    const html = renderToStaticMarkup(<EditorDeLineas lineasIniciales={[{ ...base, material: 'couché 300 g' }]} alCambiar={() => {}} />);
    expect(html).toContain('Ficha de máquina (opcional)');
    expect(html).toContain('value="couché 300 g"');
    expect(html).toContain('open=""');
  });
  it('sin ficha nace plegada', () => {
    const html = renderToStaticMarkup(<EditorDeLineas lineasIniciales={[base]} alCambiar={() => {}} />);
    expect(html).toContain('Ficha de máquina (opcional)');
    expect(html).not.toContain('open=""');
  });
});
