import { describe, expect, it } from 'vitest';
import { leerDias, mensajeConEnlace, sePuedeGenerarEnlace, textoDeVigencia, textoDeVistas } from './logica-enlace.ts';

const C = { codigo: 'COT-2026-0007', clienteNombre: 'Cristina' };
const URL = 'https://erp.pe/api/v1/c/abc';

describe('mensajeConEnlace', () => {
  it('reemplaza todas las marcas {enlace} de la plantilla', () => {
    expect(mensajeConEnlace('Mira {enlace} o abre {enlace}', URL, C)).toBe(`Mira ${URL} o abre ${URL}`);
  });
  it('si la plantilla no trae la marca, pone el enlace al final', () => {
    expect(mensajeConEnlace('  Te enviamos la cotización.  ', URL, C)).toBe(`Te enviamos la cotización.\n${URL}`);
  });
  it('sin plantilla usa un mensaje con el código, el cliente y el enlace', () => {
    const m = mensajeConEnlace(null, URL, C);
    expect(m).toContain('Hola Cristina');
    expect(m).toContain('COT-2026-0007');
    expect(m.endsWith(URL)).toBe(true);
    expect(mensajeConEnlace('  ', URL, { ...C, clienteNombre: null }).startsWith('Hola, ')).toBe(true);
  });
});

describe('textos y validación', () => {
  it('solo se genera enlace de una cotización emitida o enviada', () => {
    expect(['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada'].filter(sePuedeGenerarEnlace)).toEqual(['emitida', 'enviada']);
  });
  it('vistas y vigencia', () => {
    expect(textoDeVistas(0, null)).toBe('Aún no la abrió');
    expect(textoDeVistas(1, '2026-11-17T15:00:00.000Z')).toMatch(/^1 vez · última 17\/11\/2026 10:00$/);
    expect(textoDeVistas(3, null)).toContain('3 veces');
    expect(textoDeVigencia({ estado: 'vigente', venceEn: '2026-12-17T15:00:00.000Z', revocadoEn: null })).toBe('Vence el 17/12/2026');
    expect(textoDeVigencia({ estado: 'revocado', venceEn: '2026-12-17T15:00:00.000Z', revocadoEn: '2026-11-18T15:00:00.000Z' })).toBe('Revocado el 18/11/2026');
  });
  it('los días van de 1 a 365', () => {
    expect([leerDias('15'), leerDias(' 30 '), leerDias('365'), leerDias('0'), leerDias('366'), leerDias('x'), leerDias('')]).toEqual([15, 30, 365, undefined, undefined, undefined, undefined]);
  });
});
