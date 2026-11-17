import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoUnidad } from './campo-unidad.tsx';

describe('CampoUnidad', () => {
  it('con una unidad conocida no muestra el campo libre', () => {
    const html = renderToStaticMarkup(<CampoUnidad valor="UND" alCambiar={() => {}} />);
    expect(html).not.toContain('Otra unidad');
    expect(html).toContain('Otra…');
  });
  it('«und» en minúsculas (como la guarda el catálogo) también es una unidad conocida', () => {
    expect(renderToStaticMarkup(<CampoUnidad valor="und" alCambiar={() => {}} />)).not.toContain('Otra unidad');
  });
  it('con una unidad desconocida abre «Otra…» y muestra el campo libre con su valor', () => {
    const html = renderToStaticMarkup(<CampoUnidad valor="bobina" alCambiar={() => {}} />);
    expect(html).toContain('Otra unidad');
    expect(html).toContain('bobina');
  });
});

describe('CampoUnidad con las unidades de la empresa', () => {
  it('muestra el grupo «De tu empresa» antes de las comunes y no repite las que ya ofrece', () => {
    const html = renderToStaticMarkup(<CampoUnidad valor="Rollo grande" unidadesDeLaEmpresa={['Rollo grande', 'caja']} alCambiar={() => {}} />);
    expect(html.indexOf('De tu empresa')).toBeGreaterThan(-1);
    expect(html.indexOf('De tu empresa')).toBeLessThan(html.indexOf('Cantidad'));
    expect(html).not.toContain('Otra unidad');
    expect(html.match(/value="caja"/g)).toHaveLength(1);
  });
  it('sin la prop se comporta como siempre', () => {
    expect(renderToStaticMarkup(<CampoUnidad valor="UND" alCambiar={() => {}} />)).not.toContain('De tu empresa');
  });
});
