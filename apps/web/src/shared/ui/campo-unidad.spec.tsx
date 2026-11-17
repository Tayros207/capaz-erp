import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CampoUnidad } from './campo-unidad.tsx';

describe('CampoUnidad', () => {
  it('con una unidad conocida no muestra el campo libre', () => {
    const html = renderToStaticMarkup(<CampoUnidad valor="UND" alCambiar={() => {}} />);
    expect(html).not.toContain('Otra unidad');
    expect(html).toContain('Otra…');
  });
  it('con una unidad desconocida abre «Otra…» y muestra el campo libre con su valor', () => {
    const html = renderToStaticMarkup(<CampoUnidad valor="bobina" alCambiar={() => {}} />);
    expect(html).toContain('Otra unidad');
    expect(html).toContain('bobina');
  });
});
