import { describe, expect, it } from 'vitest';
import { detectarPreguntaDePrecio as d } from './pregunta-de-precio.js';

describe('detectarPreguntaDePrecio', () => {
  it('cuánto le cobramos a X por Y', () => {
    expect(d('cuánto le cobramos a Cristina por las cajas de bocaditos')).toEqual({ clienteTexto: 'Cristina', productoTexto: 'las cajas de bocaditos' });
    expect(d('¿Cuánto le cobramos a Imprenta Sur por volantes la última vez?')).toEqual({ clienteTexto: 'Imprenta Sur', productoTexto: 'volantes' });
  });
  it('precio anterior de Y para X', () => {
    expect(d('precio anterior de volantes para Imprenta Sur')).toEqual({ clienteTexto: 'Imprenta Sur', productoTexto: 'volantes' });
    expect(d('último precio de las tarjetas a Panadería Luna')).toEqual({ clienteTexto: 'Panadería Luna', productoTexto: 'tarjetas' });
  });
  it('a cuánto le vendimos Y a X', () => {
    expect(d('a cuánto le vendimos los banners a Hotel Andes')).toEqual({ clienteTexto: 'Hotel Andes', productoTexto: 'los banners' });
  });
  it('un cliente con «de» en el nombre no se parte si hay «por»', () => {
    expect(d('cuanto le cobramos a Imprenta de Lima por sobres')).toEqual({ clienteTexto: 'Imprenta de Lima', productoTexto: 'sobres' });
  });
  it('null si no es una pregunta de precio', () => {
    expect(d('crear pedido para Cristina por 5 cajas')).toBeNull();
    expect(d('cobré 200 soles a Cristina')).toBeNull();
    expect(d('cuánto le cobramos a Cristina')).toBeNull();
    expect(d('')).toBeNull();
  });
});
