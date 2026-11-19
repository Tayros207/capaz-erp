import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ListaDelSelector } from './lista-del-selector.tsx';

const opciones = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, nombre: `Cliente ${i}` }));
const base = { id: 'x', etiqueta: 'Cliente', abierto: true, activo: -1, opciones, cargando: false, falla: false, textoVacio: 'Nada', crear: null, alElegir: () => {} };

describe('ListaDelSelector', () => {
  it('la opción de crear va después de los 8 resultados, fija abajo', () => {
    const html = renderToStaticMarkup(<ListaDelSelector {...base} crear="Crear cliente «Ana»" />);
    expect(html.match(/role="option"/g)).toHaveLength(9);
    expect(html.indexOf('Cliente 7')).toBeLessThan(html.indexOf('Crear cliente'));
    expect(html).toMatch(/id="x-op-8"/);
    expect(html).toContain('sticky');
    expect(html).toContain('bottom-0');
  });
  it('sin crear no aparece', () => {
    expect(renderToStaticMarkup(<ListaDelSelector {...base} />)).not.toContain('Crear');
  });
  it('la opción de crear activa se marca seleccionada', () => {
    const html = renderToStaticMarkup(<ListaDelSelector {...base} activo={8} crear="Crear cliente «Ana»" />);
    expect(html).toMatch(/id="x-op-8"[^>]*aria-selected="true"/);
  });
  it('sin resultados, el aviso va antes de crear', () => {
    const html = renderToStaticMarkup(<ListaDelSelector {...base} opciones={[]} crear="Crear cliente «Ana»" />);
    expect(html.indexOf('Nada')).toBeLessThan(html.indexOf('Crear cliente'));
  });
  it('cerrada lleva hidden', () => {
    expect(renderToStaticMarkup(<ListaDelSelector {...base} abierto={false} />)).toContain('hidden');
  });
});
