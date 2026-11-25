import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { CajaDeMensaje } from './caja-de-mensaje.tsx';
import { puedeEnviar, teclaDeEnvio } from './logica-caja.ts';

const voz = (o: Partial<ReconocedorDeVoz> = {}): ReconocedorDeVoz => ({ estado: 'listo', texto: '', aviso: null, iniciar: () => {}, detener: () => {}, limpiar: () => {}, ...o });
const html = (valor: string, o: { voz?: ReconocedorDeVoz; ocupado?: boolean } = {}) =>
  renderToStaticMarkup(
    <CajaDeMensaje valor={valor} alCambiar={() => {}} alEnviar={() => {}} alAlternarVoz={() => {}} voz={o.voz ?? voz()} ocupado={o.ocupado ?? false} maximo={500} marcador="Escribe o dicta" />,
  );

/** La etiqueta de apertura del botón de enviar, para mirar sus atributos sin confundirlos con clases como `disabled:opacity-50`. */
const botonEnviar = (h: string): string => /<button\b[^>]*aria-label="Enviar"[^>]*>/.exec(h)?.[0] ?? '';

describe('teclaDeEnvio', () => {
  it('Enter envía y Mayús+Enter salta de línea', () => {
    expect(teclaDeEnvio({ key: 'Enter', shiftKey: false })).toBe('enviar');
    expect(teclaDeEnvio({ key: 'Enter', shiftKey: true })).toBe('salto');
  });
  it('durante la composición de texto no envía', () => {
    expect(teclaDeEnvio({ key: 'Enter', shiftKey: false, isComposing: true })).toBeNull();
  });
  it('otras teclas no hacen nada', () => {
    expect(teclaDeEnvio({ key: 'a', shiftKey: false })).toBeNull();
  });
});

describe('puedeEnviar', () => {
  it('exige texto y que no haya una respuesta en curso', () => {
    expect(puedeEnviar('hola', false)).toBe(true);
    expect(puedeEnviar('   ', false)).toBe(false);
    expect(puedeEnviar('hola', true)).toBe(false);
  });
});

describe('CajaDeMensaje', () => {
  it('con voz disponible pinta el micrófono; el contador solo aparece cerca del límite', () => {
    const h = html('hola');
    expect(h).toContain('aria-label="Dictar con el micrófono"');
    expect(h).not.toContain('de 500');
    expect(html('x'.repeat(420))).toContain('420 de 500');
    expect(h).toContain('aria-label="Mensaje para el asistente"');
  });

  it('sin voz en el navegador no hay botón de micrófono', () => {
    expect(html('hola', { voz: voz({ estado: 'no_disponible' }) })).not.toContain('micrófono');
    expect(html('hola', { voz: voz({ estado: 'sin_contexto_seguro' }) })).not.toContain('micrófono');
  });

  it('si el navegador no reconoce voz, lo dice con una nota discreta (no con una alerta amarilla) y sin micrófono', () => {
    const h = html('', { voz: voz({ estado: 'no_disponible', aviso: 'Este navegador no reconoce voz.' }) });
    expect(h).toContain('role="note"');
    expect(h).toContain('Este navegador no reconoce voz.');
    expect(h).not.toContain('border-aviso');
    expect(h).not.toContain('Dictar con el micrófono');
  });

  it('un problema mientras se dicta (con micrófono) sí se muestra como aviso de estado', () => {
    const h = html('', { voz: voz({ estado: 'listo', aviso: 'No se oyó nada.' }) });
    expect(h).toContain('role="status"');
    expect(h).toContain('No se oyó nada.');
  });

  it('mientras escucha, el botón queda presionado y en variante de peligro', () => {
    const h = html('', { voz: voz({ estado: 'escuchando' }) });
    expect(h).toContain('aria-pressed="true"');
    expect(h).toContain('aria-label="Dejar de escuchar"');
    expect(h).toContain('bg-peligro');
  });

  it('grabando por audio (Firefox) dice «Grabando… (toca para terminar)» y el botón termina la grabación', () => {
    const h = html('', { voz: voz({ estado: 'escuchando', via: 'audio' }) });
    expect(h).toContain('Grabando… (toca para terminar)');
    expect(h).toContain('aria-label="Terminar la grabación"');
    expect(h).toContain('aria-pressed="true"');
    expect(h).not.toContain('Escuchando…');
  });

  it('transcribiendo dice «Transcribiendo…», el micrófono espera y no se puede enviar todavía', () => {
    const h = html('hola', { voz: voz({ estado: 'transcribiendo', via: 'audio' }) });
    expect(h).toContain('Transcribiendo…');
    expect(/<button\b[^>]*aria-label="Transcribiendo el audio"[^>]*>/.exec(h)?.[0]).toContain(' disabled=""');
    expect(botonEnviar(h)).toContain(' disabled=""');
  });

  it('si la vía de audio sí sirve, no sale la nota de «no reconoce voz»', () => {
    const h = html('', { voz: voz({ estado: 'listo', via: 'audio' }) });
    expect(h).toContain('aria-label="Dictar con el micrófono"');
    expect(h).not.toContain('no reconoce voz');
  });

  it('con una respuesta en curso, enviar sale deshabilitado', () => {
    const h = html('hola', { ocupado: true });
    expect(botonEnviar(h)).toContain(' disabled=""');
  });

  it('con una respuesta en curso y una forma de detenerla, el botón de enviar pasa a ser «Detener»', () => {
    const h = renderToStaticMarkup(<CajaDeMensaje valor="" alCambiar={() => {}} alEnviar={() => {}} alAlternarVoz={() => {}} voz={voz()} ocupado maximo={500} marcador="x" alDetener={() => {}} />);
    expect(h).toContain('aria-label="Detener la respuesta"');
    expect(h).not.toContain('aria-label="Enviar"');
  });

  it('sin forma de detener (el modo sin modelo), con la respuesta en curso sigue el botón de enviar bloqueado', () => {
    expect(botonEnviar(html('hola', { ocupado: true }))).toContain(' disabled=""');
    expect(html('hola', { ocupado: true })).not.toContain('Detener');
  });

  it('con la caja vacía, enviar sale deshabilitado; con texto, habilitado', () => {
    expect(botonEnviar(html(''))).toContain(' disabled=""');
    expect(botonEnviar(html('hola'))).not.toContain(' disabled=""');
  });
});
