import { describe, expect, it } from 'vitest';
import { argumentosDe, busquedaDe, destinoDePreguntaDePrecio, leerDireccion, rutaDePrecios } from './logica.ts';

describe('rutaDePrecios', () => {
  it('arma la dirección con el cliente, el producto o ambos', () => {
    expect(rutaDePrecios({ clienteTexto: 'Cristina', productoTexto: 'cajas de bocaditos' })).toBe('/precios?cliente=Cristina&q=cajas+de+bocaditos');
    expect(rutaDePrecios({ clienteId: 'c1', clienteNombre: 'Cristina Neira' })).toBe('/precios?clienteId=c1&nombre=Cristina+Neira');
    expect(rutaDePrecios({})).toBe('/precios');
  });
});

describe('destinoDePreguntaDePrecio', () => {
  it('lleva la pregunta de precio a la pantalla; un movimiento dictado no', () => {
    expect(destinoDePreguntaDePrecio('cuánto le cobramos a Cristina por las cajas de bocaditos')).toBe('/precios?cliente=Cristina&q=las+cajas+de+bocaditos');
    expect(destinoDePreguntaDePrecio('Ingreso 500 soles, cliente Juan Pérez, flyers')).toBeNull();
  });
});

describe('leerDireccion y busquedaDe', () => {
  it('lee los parámetros; pide producto o cliente', () => {
    const d = leerDireccion(new URLSearchParams('cliente= Cristina &q=cajas'));
    expect(d).toEqual({ clienteId: '', clienteNombre: '', clienteTexto: 'Cristina', texto: 'cajas' });
    expect(busquedaDe(d)).toEqual({ clienteTexto: 'Cristina', texto: 'cajas' });
    expect(busquedaDe({ clienteId: 'c1', clienteTexto: 'x', texto: 'cajas' })).toEqual({ clienteId: 'c1', texto: 'cajas' });
    expect(busquedaDe({ texto: 'cajas' })).toEqual({ texto: 'cajas' });
    expect(busquedaDe({ texto: ' ' })).toBeNull();
  });
  it('solo con el cliente (la ficha del cliente abre así) busca sus últimos precios', () => {
    expect(busquedaDe(leerDireccion(new URLSearchParams('clienteId=c1&nombre=Cristina')))).toEqual({ clienteId: 'c1' });
    expect(busquedaDe({ clienteTexto: ' Cristina ', texto: 'c' })).toEqual({ clienteTexto: 'Cristina' });
  });
  it('los argumentos llevan el límite: 15 por producto, 30 solo con el cliente', () => {
    expect(argumentosDe({ texto: 'cajas' })).toEqual({ texto: 'cajas', limite: 15 });
    expect(argumentosDe({ clienteId: 'c1' })).toEqual({ clienteId: 'c1', limite: 30 });
  });
});
