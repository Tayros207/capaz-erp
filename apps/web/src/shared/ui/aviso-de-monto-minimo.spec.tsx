import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AvisoDeMontoMinimoFijo } from './aviso-de-monto-minimo.tsx';

const html = (total: number, minimo = 4000) => renderToStaticMarkup(<AvisoDeMontoMinimoFijo totalCentimos={total} minimoCentimos={minimo} />);

describe('AvisoDeMontoMinimoFijo', () => {
  it('avisa por debajo del mínimo, con role="status" y el texto exacto', () => {
    const h = html(2500);
    expect(h).toContain('role="status"');
    expect(h).toContain('Este trabajo suma S/ 25.00, menos que el mínimo de S/ 40.00 por trabajo.');
    expect(h).toContain('considera cobrar al menos S/ 40.00.');
  });
  it('usa el mínimo que recibe', () => {
    expect(html(2500, 3000)).toContain('menos que el mínimo de S/ 30.00 por trabajo.');
    expect(html(3500, 3000)).toBe('');
  });
  it('se calla con total en cero, igual al mínimo o mayor', () => {
    expect(html(0)).toBe('');
    expect(html(4000)).toBe('');
    expect(html(9000)).toBe('');
  });
  it('con el mínimo en cero (apagado) nunca avisa', () => {
    expect(html(100, 0)).toBe('');
  });
});
