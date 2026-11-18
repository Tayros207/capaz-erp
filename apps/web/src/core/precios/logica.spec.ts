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
  it('lee los parámetros y exige el producto', () => {
    const d = leerDireccion(new URLSearchParams('cliente= Cristina &q=cajas'));
    expect(d).toEqual({ clienteId: '', clienteNombre: '', clienteTexto: 'Cristina', texto: 'cajas' });
    expect(busquedaDe(d)).toEqual({ clienteTexto: 'Cristina', texto: 'cajas' });
    expect(busquedaDe({ ...d, texto: ' ' })).toBeNull();
    expect(busquedaDe({ clienteId: 'c1', clienteTexto: 'x', texto: 'cajas' })).toEqual({ clienteId: 'c1', texto: 'cajas' });
    expect(busquedaDe({ texto: 'cajas' })).toEqual({ texto: 'cajas' });
  });
  it('los argumentos llevan el límite', () => {
    expect(argumentosDe({ texto: 'cajas' })).toEqual({ texto: 'cajas', limite: 15 });
  });
});
