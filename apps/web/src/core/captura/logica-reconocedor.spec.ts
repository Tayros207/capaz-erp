import { describe, expect, it } from 'vitest';
import {
  AVISO_SIN_RECONOCIMIENTO, AVISO_TOPE_DE_GRABACION, avisoDeErrorDeVoz, codigoDeErrorDeMicrofono, desenlaceDeTranscripcion, elegirViaDeVoz, etiquetaDelBotonDeVoz,
  lineaDeEstadoDeVoz, recortarTexto, unirConBase, unirResultados, unirSesion, type CapacidadesDeVoz, type ListaDeResultados,
} from './logica-reconocedor.ts';

const r = (...items: Array<[string, boolean]>): ListaDeResultados =>
  Object.assign(items.map(([transcript, isFinal]) => ({ isFinal, 0: { transcript } })), {}) as unknown as ListaDeResultados;

describe('unirResultados', () => {
  it('en continuo concatena todo', () => {
    expect(unirResultados(r(['ingreso ', true], ['500 soles', false]), true)).toBe('ingreso 500 soles');
  });
  it('por sesiones une finales y el último parcial', () => {
    expect(unirResultados(r(['ingreso 500', true], ['soles', false]), false)).toBe('ingreso 500 soles');
  });
  it('no repite el parcial si ya está al final', () => {
    expect(unirResultados(r(['ingreso 500 soles', true], ['soles', false]), false)).toBe('ingreso 500 soles');
  });
  it('sin parcial devuelve los finales', () => {
    expect(unirResultados(r(['hola', true]), false)).toBe('hola');
  });
});

describe('unirSesion', () => {
  it('une sin repetir la cola', () => {
    expect(unirSesion('ingreso 500', 'ingreso 500 soles')).toBe('ingreso 500 soles');
    expect(unirSesion('ingreso 500 soles', 'soles cliente Juan')).toBe('ingreso 500 soles cliente Juan');
  });
  it('si no hay solapamiento, separa con espacio', () => {
    expect(unirSesion('hola', 'mundo')).toBe('hola mundo');
  });
  it('maneja vacíos', () => {
    expect(unirSesion('', ' a ')).toBe('a');
    expect(unirSesion('a', '')).toBe('a');
  });
});

describe('recorte y base', () => {
  it('recorta al máximo', () => {
    expect(recortarTexto('x'.repeat(600))).toHaveLength(500);
    expect(recortarTexto('abcdef', 3)).toBe('abc');
  });
  it('une lo dictado a lo escrito', () => {
    expect(unirConBase('egreso ', 'luz 80')).toBe('egreso luz 80');
    expect(unirConBase('', ' luz 80 ')).toBe('luz 80');
    expect(unirConBase('a'.repeat(499), 'bbb')).toHaveLength(500);
  });
});

describe('avisos de error de voz', () => {
  it('traduce los códigos conocidos', () => {
    expect(avisoDeErrorDeVoz('network', false)).toMatch(/internet/);
    expect(avisoDeErrorDeVoz('not-allowed', true)).toMatch(/Chrome/);
    expect(avisoDeErrorDeVoz('otro', false)).toBeNull();
  });
});

describe('elegirViaDeVoz', () => {
  const todo: CapacidadesDeVoz = { contextoSeguro: true, reconocimiento: true, grabadora: true, microfono: true, audio: true };
  it('con Web Speech (Chrome, Edge, Safari) usa la del navegador', () => {
    expect(elegirViaDeVoz(todo)).toBe('navegador');
  });
  it('sin Web Speech pero con grabadora, micrófono y AudioContext (Firefox) graba y transcribe', () => {
    expect(elegirViaDeVoz({ ...todo, reconocimiento: false })).toBe('audio');
  });
  it('si falta cualquiera de las tres piezas de la grabación, ninguna', () => {
    for (const falta of ['grabadora', 'microfono', 'audio'] as const) expect(elegirViaDeVoz({ ...todo, reconocimiento: false, [falta]: false }), falta).toBe('ninguna');
  });
  it('sin https (ni localhost) no hay micrófono por ninguna vía', () => {
    expect(elegirViaDeVoz({ ...todo, contextoSeguro: false })).toBe('sin_contexto_seguro');
    expect(elegirViaDeVoz({ ...todo, reconocimiento: false, contextoSeguro: false })).toBe('sin_contexto_seguro');
  });
});

describe('lo que se ve mientras se dicta', () => {
  it('con audio dice que graba y que hay que tocar para terminar; luego, que transcribe', () => {
    expect(lineaDeEstadoDeVoz('escuchando', 'audio')).toBe('Grabando… (toca para terminar)');
    expect(lineaDeEstadoDeVoz('transcribiendo', 'audio')).toBe('Transcribiendo…');
    expect(etiquetaDelBotonDeVoz('escuchando', 'audio')).toBe('Grabando… (toca para terminar)');
    expect(etiquetaDelBotonDeVoz('transcribiendo', 'audio')).toBe('Transcribiendo…');
  });
  it('con Web Speech (o sin vía indicada) sigue como siempre', () => {
    expect(lineaDeEstadoDeVoz('escuchando', undefined)).toMatch(/^Escuchando…/);
    expect(etiquetaDelBotonDeVoz('escuchando', 'navegador')).toBe('Escuchando… toca para detener');
    expect(lineaDeEstadoDeVoz('listo', 'audio')).toBeNull();
    expect(etiquetaDelBotonDeVoz('listo', 'audio')).toBe('Tocar para hablar');
  });
});

describe('desenlaceDeTranscripcion', () => {
  it('el texto entendido va a la caja, recortado al máximo', () => {
    expect(desenlaceDeTranscripcion({ ok: true, datos: { texto: ' Ingreso 500 soles ' }, avisos: [] })).toEqual({ texto: 'Ingreso 500 soles', estado: 'listo', aviso: null });
    expect(desenlaceDeTranscripcion({ ok: true, datos: { texto: 'x'.repeat(600) }, avisos: [] }).texto).toHaveLength(500);
  });
  it('vacío avisa que no se oyó nada y deja volver a intentar', () => {
    expect(desenlaceDeTranscripcion({ ok: true, datos: { texto: '  ' }, avisos: [] })).toEqual({ texto: '', estado: 'listo', aviso: avisoDeErrorDeVoz('no-speech', false) });
  });
  it('si el servidor no transcribe (apagado) cae a la nota de siempre y quita el micrófono', () => {
    expect(desenlaceDeTranscripcion({ ok: false, error: { codigo: 'apagado', mensaje: 'x' } })).toEqual({ texto: '', estado: 'no_disponible', aviso: AVISO_SIN_RECONOCIMIENTO });
  });
  it('con el tope del mes también quita el micrófono, con el mensaje del servidor', () => {
    expect(desenlaceDeTranscripcion({ ok: false, error: { codigo: 'tope_mensual', mensaje: 'Se alcanzó el tope de uso de este mes.' } })).toMatchObject({ estado: 'no_disponible', aviso: 'Se alcanzó el tope de uso de este mes.' });
  });
  it('sin conexión u otro fallo se puede reintentar', () => {
    expect(desenlaceDeTranscripcion({ ok: false, error: { codigo: 'sin_conexion', mensaje: 'x' } })).toEqual({ texto: '', estado: 'error', aviso: avisoDeErrorDeVoz('network', false) });
    expect(desenlaceDeTranscripcion({ ok: false, error: { codigo: 'modelo_no_disponible', mensaje: 'No está disponible.' } })).toEqual({ texto: '', estado: 'error', aviso: 'No está disponible.' });
  });
});

describe('avisos de la grabación', () => {
  it('los errores del micrófono usan los mismos avisos que Web Speech', () => {
    expect(codigoDeErrorDeMicrofono('NotAllowedError')).toBe('not-allowed');
    expect(codigoDeErrorDeMicrofono('NotFoundError')).toBe('audio-capture');
    expect(avisoDeErrorDeVoz(codigoDeErrorDeMicrofono('Raro'), false)).toBeNull();
  });
  it('el tope de grabación dice cuántos segundos', () => {
    expect(AVISO_TOPE_DE_GRABACION).toMatch(/45 segundos/);
  });
});
