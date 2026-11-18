import { describe, expect, it } from 'vitest';
import { decidirOrigen, hayTexto, instanteDeInicio, lineaDeMedicion, mensajeDeErrorDeCaptura, rangoDelMes, transcurridoMs, destinoSiEsPreguntaDePrecio } from './logica.ts';

describe('origen', () => {
  it('voz aunque se retoque; texto si se escribió', () => {
    expect(decidirOrigen(true)).toBe('voz');
    expect(decidirOrigen(false)).toBe('texto');
  });
});

describe('transcurridoMs', () => {
  it('redondea la diferencia', () => expect(transcurridoMs(1000, 4200.6)).toBe(3201));
  it('topa a 15 minutos', () => expect(transcurridoMs(0, 5_000_000)).toBe(900_000));
  it('sin inicio es 0 y nunca es negativo', () => {
    expect(transcurridoMs(null, 500)).toBe(0);
    expect(transcurridoMs(900, 100)).toBe(0);
  });
  it('el primer instante manda', () => {
    expect(instanteDeInicio(null, 10)).toBe(10);
    expect(instanteDeInicio(10, 99)).toBe(10);
  });
});

describe('rangoDelMes', () => {
  it('va del día 1 a hoy', () => expect(rangoDelMes('2026-11-16')).toEqual({ desde: '2026-11-01', hasta: '2026-11-16' }));
});

describe('lineaDeMedicion', () => {
  it('sin dictados', () => expect(lineaDeMedicion({ propuestos: 0, pctSinCorregir: null, medianaSegundos: null })).toBe('Aún sin dictados'));
  it('completa', () => expect(lineaDeMedicion({ propuestos: 42, pctSinCorregir: 76.2, medianaSegundos: 24 })).toBe('Este mes: 42 dictados · 76 % sin corregir · 24 s'));
  it('omite lo que no se puede calcular', () => expect(lineaDeMedicion({ propuestos: 1, pctSinCorregir: null, medianaSegundos: null })).toBe('Este mes: 1 dictado'));
});

describe('mensajes de error', () => {
  it('por código', () => {
    expect(mensajeDeErrorDeCaptura('sin_conexion', '')).toMatch(/conexión/);
    expect(mensajeDeErrorDeCaptura('sin_permiso', '')).toMatch(/permiso/);
    expect(mensajeDeErrorDeCaptura('validacion', 'Dicta algo.')).toBe('Dicta algo.');
    expect(mensajeDeErrorDeCaptura('otro', 'Falló')).toBe('Falló');
  });
});

describe('hayTexto', () => {
  it('ignora espacios', () => {
    expect(hayTexto('  ')).toBe(false);
    expect(hayTexto(' a ')).toBe(true);
  });
});

describe('destinoSiEsPreguntaDePrecio', () => {
  it('una pregunta de precio abre /precios; un movimiento dictado sigue su camino', () => {
    expect(destinoSiEsPreguntaDePrecio('¿Cuánto le cobramos a Imprenta Sur por volantes?')).toBe('/precios?cliente=Imprenta+Sur&q=volantes');
    expect(destinoSiEsPreguntaDePrecio('Egreso 80 soles, papel bond')).toBeNull();
  });
});
