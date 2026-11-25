import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
import { BarraDeGrabacion } from './barra-de-grabacion.tsx';

const voz = (o: Partial<ReconocedorDeVoz> = {}): ReconocedorDeVoz => ({
  estado: 'escuchando', texto: '', aviso: null, iniciar: () => {}, detener: () => {}, limpiar: () => {}, via: 'audio', pausado: false, segundos: 12, pausar: vi.fn(), reanudar: vi.fn(), cancelar: vi.fn(), ...o,
});
const html = (o: Partial<ReconocedorDeVoz> = {}) => renderToStaticMarkup(<BarraDeGrabacion voz={voz(o)} />);

describe('BarraDeGrabacion', () => {
  it('mientras graba muestra el contador contra el tope y los botones de pausar y cancelar', () => {
    const h = html();
    expect(h).toContain('Grabando');
    expect(h).toContain('0:12 / 0:45');
    expect(h).toContain('aria-label="Pausar la grabación"');
    expect(h).toContain('aria-label="Cancelar la grabación"');
    expect(h).toContain('scaleX(0.26');
  });
  it('en pausa lo dice, el botón pasa a «Seguir» y el punto deja de latir', () => {
    const h = html({ pausado: true });
    expect(h).toContain('En pausa');
    expect(h).toContain('aria-label="Reanudar la grabación"');
    expect(h).toContain('>Seguir<');
    expect(h).not.toContain('animate-pulse');
  });
  it('sin funciones de pausa o de cancelar (otra vía) no inventa botones', () => {
    const h = html({ pausar: undefined, reanudar: undefined, cancelar: undefined });
    expect(h).not.toContain('Pausar');
    expect(h).not.toContain('Cancelar');
  });
  it('mientras transcribe solo muestra el estado, sin controles', () => {
    const h = html({ estado: 'transcribiendo' });
    expect(h).toContain('Transcribiendo el audio');
    expect(h).not.toContain('Pausar');
  });
  it('el avance de la barra nunca pasa del tope', () => {
    expect(html({ segundos: 400 })).toContain('scaleX(1)');
  });
});
