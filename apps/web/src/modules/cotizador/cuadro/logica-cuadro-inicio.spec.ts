import { describe, expect, it } from 'vitest';
import { argumentosDeInicio } from './logica-cuadro-inicio.ts';

describe('iniciar un cuadro', () => {
  it('manda la plantilla y solo el título y el cliente que se pusieron', () => {
    expect(argumentosDeInicio({ plantilla: 'volantes', titulo: ' ', clienteId: null })).toEqual({ plantilla: 'volantes' });
    expect(argumentosDeInicio({ plantilla: 'en_blanco', titulo: ' Folletos ', clienteId: 'c1' })).toEqual({ plantilla: 'en_blanco', titulo: 'Folletos', clienteId: 'c1' });
  });
});
