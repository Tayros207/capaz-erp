import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TablaImprimible } from './hoja-imprimible.tsx';

describe('TablaImprimible con texto secundario', () => {
  it('imprime la ficha bajo la descripción solo en la fila que la tiene', () => {
    const html = renderToStaticMarkup(
      <TablaImprimible etiqueta="Detalle" columnas={[{ clave: 'descripcion', titulo: 'Descripción', secundaria: 'ficha' }]} filas={[{ descripcion: 'Polo', ficha: 'Material: couché' }, { descripcion: 'Gorra' }]} />,
    );
    expect(html).toContain('<span class="block text-[0.85em] italic">Material: couché</span>');
    expect(html.match(/italic/g)).toHaveLength(1);
  });
});
