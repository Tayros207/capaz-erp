import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FormularioCliente } from './formulario-cliente.tsx';
import { FORMULARIO_VACIO } from './logica.ts';

const props = { valor: FORMULARIO_VACIO, errores: {}, alCambiar: () => {} };

describe('FormularioCliente', () => {
  it('compacto: sin correo ni notas, con lo esencial', () => {
    const html = renderToStaticMarkup(<FormularioCliente {...props} compacto />);
    expect(html).not.toContain('Correo');
    expect(html).not.toContain('Notas');
    for (const t of ['Nombre', 'Tipo de documento', 'Número de documento', 'Teléfono', 'Dirección']) expect(html).toContain(t);
  });
  it('completo: con correo y notas', () => {
    const html = renderToStaticMarkup(<FormularioCliente {...props} />);
    expect(html).toContain('Correo');
    expect(html).toContain('Notas');
  });
});
