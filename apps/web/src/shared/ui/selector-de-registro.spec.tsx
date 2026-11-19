import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SelectorDeRegistro } from './selector-de-registro.tsx';

const base = { etiqueta: 'Cliente', valor: null, alCambiar: () => {}, buscar: async () => [] };

describe('SelectorDeRegistro', () => {
  it('con alCrear y botonCrear muestra el botón', () => {
    expect(renderToStaticMarkup(<SelectorDeRegistro {...base} alCrear={() => {}} botonCrear="Nuevo cliente" />)).toContain('Nuevo cliente');
  });
  it('sin botonCrear o sin alCrear no lo muestra', () => {
    expect(renderToStaticMarkup(<SelectorDeRegistro {...base} alCrear={() => {}} />)).not.toContain('Nuevo cliente');
    expect(renderToStaticMarkup(<SelectorDeRegistro {...base} botonCrear="Nuevo cliente" />)).not.toContain('Nuevo cliente');
  });
  it('con valor muestra Cambiar y no el botón de crear', () => {
    const html = renderToStaticMarkup(<SelectorDeRegistro {...base} valor={{ id: '1', nombre: 'Ana' }} alCrear={() => {}} botonCrear="Nuevo cliente" />);
    expect(html).toContain('Cambiar');
    expect(html).not.toContain('Nuevo cliente');
  });
  it('la etiqueta apunta al campo', () => {
    const html = renderToStaticMarkup(<SelectorDeRegistro {...base} />);
    const para = /for="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${para}"`);
  });
});
