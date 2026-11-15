import { describe, expect, it } from 'vitest';
import {
  contarFilasDeCsv, eventosDeTexto, fechaHora, filasDeObjeto, nombreDeArchivoSeguro, objetoDeFilas, resumenDeLectura,
  validarArchivoCsv, validarNombre, validarUrlDeWebhook, valorDeTexto,
} from './logica.ts';

describe('valores de configuración', () => {
  it('convierte texto a su tipo', () => {
    expect(valorDeTexto('true')).toBe(true);
    expect(valorDeTexto('false')).toBe(false);
    expect(valorDeTexto('12.5')).toBe(12.5);
    expect(valorDeTexto('hola')).toBe('hola');
    expect(valorDeTexto('')).toBe('');
  });
  it('arma el objeto y descarta filas sin nombre', () => {
    expect(objetoDeFilas([{ nombre: ' ruc ', valor: '20123456789' }, { nombre: '', valor: 'x' }, { nombre: 'activo', valor: 'true' }])).toEqual({ ok: true, datos: { ruc: 20123456789, activo: true } });
  });
  it('rechaza nombres repetidos', () => {
    expect(objetoDeFilas([{ nombre: 'a', valor: '1' }, { nombre: 'a', valor: '2' }])).toEqual({ ok: false, error: 'El campo «a» está repetido.' });
  });
  it('vuelve del objeto a filas', () => {
    expect(filasDeObjeto({ a: 1, b: null, c: { x: 1 } })).toEqual([{ nombre: 'a', valor: '1' }, { nombre: 'b', valor: '' }, { nombre: 'c', valor: '{"x":1}' }]);
  });
});

describe('eventos de un webhook', () => {
  it('acepta eventos, familias y todo; quita repetidos', () => {
    expect(eventosDeTexto('cliente.creado, producto.* cliente.creado\n*')).toEqual({ ok: true, eventos: ['cliente.creado', 'producto.*', '*'] });
  });
  it('rechaza vacío, mal formados y demasiados', () => {
    expect(eventosDeTexto('  ').ok).toBe(false);
    expect(eventosDeTexto('Cliente')).toMatchObject({ ok: false });
    expect(eventosDeTexto(Array.from({ length: 21 }, (_, i) => `a.e${i}`).join(','))).toMatchObject({ ok: false });
  });
});

describe('validaciones de formulario', () => {
  it('valida la dirección', () => {
    expect(validarUrlDeWebhook('')).toBeTruthy();
    expect(validarUrlDeWebhook('no es url')).toBeTruthy();
    expect(validarUrlDeWebhook('ftp://x.pe')).toBeTruthy();
    expect(validarUrlDeWebhook('https://x.pe/capaz')).toBeUndefined();
  });
  it('valida el nombre', () => {
    expect(validarNombre('  ', 'a la clave')).toBe('Ponle un nombre a la clave.');
    expect(validarNombre('x'.repeat(81), 'a la clave')).toBeTruthy();
    expect(validarNombre('Zapier', 'a la clave')).toBeUndefined();
  });
});

describe('archivo CSV', () => {
  it('cuenta filas de datos', () => {
    expect(contarFilasDeCsv('a,b\n1,2\r\n3,4\n\n')).toBe(2);
    expect(contarFilasDeCsv('')).toBe(0);
  });
  it('valida extensión, vacío y límites', () => {
    expect(validarArchivoCsv('datos.xlsx', 'a\n1')).toMatch(/CSV/);
    expect(validarArchivoCsv('datos.csv', '  ')).toBe('El archivo está vacío.');
    expect(validarArchivoCsv('datos.csv', 'x'.repeat(200_001))).toMatch(/demasiado grande/);
    expect(validarArchivoCsv('datos.csv', `a\n${'1\n'.repeat(1001)}`)).toMatch(/filas/);
    expect(validarArchivoCsv('datos.CSV', 'a\n1')).toBeUndefined();
  });
  it('resume la lectura', () => {
    expect(resumenDeLectura({ total: 10, nuevas: 7, duplicadasTotal: 2, erroresTotal: 1 })).toBe('10 filas leídas: 7 por crear, 2 repetidas (se omiten), 1 con error.');
    expect(resumenDeLectura({ total: 3, creadas: 3, duplicadasTotal: 0, erroresTotal: 0 })).toContain('3 creadas');
  });
  it('limpia el nombre de descarga', () => {
    expect(nombreDeArchivoSeguro('../clientes 2026.csv')).toBe('_clientes_2026.csv');
    expect(nombreDeArchivoSeguro('')).toBe('exportacion.csv');
  });
});

describe('fecha', () => {
  it('tolera vacío y basura', () => {
    expect(fechaHora(null)).toBe('—');
    expect(fechaHora('x')).toBe('—');
    expect(fechaHora('2026-11-15T10:00:00Z')).not.toBe('—');
  });
});
