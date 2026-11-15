import { describe, expect, it } from 'vitest';
import { claveDeEncabezado, filaDeCliente, filaDeProducto, mapearColumnas, milesimasDeTexto, textoDeMilesimas } from './columnas.js';

describe('milésimas', () => {
  it('convierte soles sin decimales binarios y rechaza lo que no es un monto', () => {
    expect(milesimasDeTexto('25')).toBe(25000);
    expect(milesimasDeTexto('25,5')).toBe(25500);
    expect(milesimasDeTexto('0.125')).toBe(125);
    expect(milesimasDeTexto('19.99')).toBe(19990);
    for (const mal of ['', 'abc', '-1', '1.2345', '1,000.50', '1e3']) expect(milesimasDeTexto(mal)).toBeNull();
  });
  it('ida y vuelta con la exportación', () => {
    for (const m of [0, 5, 25000, 25500, 25125, 1999990]) expect(milesimasDeTexto(textoDeMilesimas(m))).toBe(m);
    expect(textoDeMilesimas(25000)).toBe('25.00');
  });
});

describe('mapearColumnas', () => {
  it('reconoce encabezados con tildes, mayúsculas y alias; ignora y reporta lo demás', () => {
    expect(claveDeEncabezado('Número de documento')).toBe('numerodedocumento');
    const c = mapearColumnas('clientes', ['Razón Social', 'Teléfono', 'Color favorito', 'Número de documento', 'Tipo de documento']);
    expect(c).toEqual({ indices: { nombre: 0, telefono: 1, documentoNumero: 3, documentoTipo: 4 }, ignoradas: ['Color favorito'] });
  });
  it('exige nombre y no admite el mismo campo dos veces', () => {
    expect(mapearColumnas('productos', ['precio'])).toMatchObject({ error: expect.stringContaining('nombre') });
    expect(mapearColumnas('productos', ['nombre', 'Producto'])).toMatchObject({ error: expect.stringContaining('repite') });
  });
});

describe('filas', () => {
  it('un RUC sin clase es empresa y un DNI corto se rechaza con su motivo', () => {
    const ind = { nombre: 0, documentoTipo: 1, documentoNumero: 2 };
    const ok = filaDeCliente(['Imprenta Sol', 'RUC', '20123456789'], ind);
    expect(ok).toMatchObject({ ok: true, valor: { clave: { nombre: 'imprenta sol', documento: 'ruc:20123456789' } } });
    expect(filaDeCliente(['Ana', 'dni', '123'], ind)).toMatchObject({ ok: false });
    expect(filaDeCliente(['Ana', 'ruc', ''], ind)).toMatchObject({ ok: false });
  });
  it('un producto convierte el precio y el IGV', () => {
    const ind = { nombre: 0, precio: 1, afectoIgv: 2, codigo: 3 };
    expect(filaDeProducto(['Tarjetas', '25,50', 'No', 'tar-1'], ind)).toMatchObject({
      ok: true,
      valor: { args: { precioUnitarioMilesimas: 25500, afectoIgv: false, tipo: 'producto' }, clave: { codigo: 'TAR-1' } },
    });
    expect(filaDeProducto(['X', '1.2345', '', ''], ind)).toMatchObject({ ok: false });
  });
});
