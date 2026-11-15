import { describe, expect, it } from 'vitest';
import { argumentosDeListado, detalleDeEvento, textoDeAccion } from './logica.ts';

describe('pantalla Historial', () => {
  it('nombra las acciones conocidas y deja legibles las demás', () => {
    expect(textoDeAccion('empresa_actualizar_configuracion')).toBe('Cambió la configuración de la empresa');
    expect(textoDeAccion('clientes_crear')).toBe('clientes crear');
  });

  it('el detalle es el resumen seguro de la herramienta, o el código del rechazo', () => {
    expect(detalleDeEvento({ resumen: { resumen: 'Cambió la zona' }, codigo: null })).toBe('Cambió la zona');
    expect(detalleDeEvento({ resumen: {}, codigo: 'sin_permiso' })).toBe('sin_permiso');
    expect(detalleDeEvento({ resumen: { resumen: 3 }, codigo: null })).toBe('');
  });

  it('arma los argumentos sin enviar filtros vacíos', () => {
    expect(argumentosDeListado({ herramienta: ' ', resultado: '' })).toEqual({ limite: 25 });
    expect(argumentosDeListado({ herramienta: 'x', resultado: 'ok' }, 'c1')).toEqual({ limite: 25, cursor: 'c1', herramienta: 'x', resultado: 'ok' });
  });
});
