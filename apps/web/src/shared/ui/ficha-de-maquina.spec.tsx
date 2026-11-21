import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FichaDeMaquina, type ValoresDeFicha } from './ficha-de-maquina.tsx';

const vacia: ValoresDeFicha = { material: '', medida: '', colores: '', acabado: '' };
const html = (valores: ValoresDeFicha, deshabilitado = false) => renderToStaticMarkup(<FichaDeMaquina n={2} valores={valores} deshabilitado={deshabilitado} alCambiar={() => {}} />);

describe('FichaDeMaquina', () => {
  it('vacía nace plegada y con los datos de cada campo', () => {
    const h = html(vacia);
    expect(h).toContain('Ficha de máquina (opcional)');
    expect(h).toContain('aria-label="Material del ítem 2"');
    expect(h).toContain('maxLength="120"');
    expect(h).toContain('placeholder="couché 150g"');
    expect(h).not.toContain('open=""');
  });
  it('con datos nace abierta', () => {
    const h = html({ ...vacia, medida: 'A5' });
    expect(h).toContain('open=""');
    expect(h).toContain('value="A5"');
  });
  it('deshabilitada bloquea los cuatro campos', () => {
    expect(html(vacia, true).match(/disabled=""/g)).toHaveLength(4);
  });
});
