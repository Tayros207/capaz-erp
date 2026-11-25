import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GrabadoraDeVoz, type AvisosDeGrabadora } from './grabadora-de-voz.ts';
import { SEGUNDOS_MAXIMOS_DE_GRABACION } from './logica-audio.ts';

// La grabadora con un micrófono y un MediaRecorder de mentira: se prueba el tiempo (sin contar las pausas), el tope y los controles.

class GrabadoraFalsa {
  static ultima: GrabadoraFalsa;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor() {
    GrabadoraFalsa.ultima = this;
  }
  start(): void {
    this.state = 'recording';
  }
  pause(): void {
    this.state = 'paused';
  }
  resume(): void {
    this.state = 'recording';
  }
  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }
}

let ahora = 0;
const pista = { stop: vi.fn() };
const avisos = (): AvisosDeGrabadora & Record<string, ReturnType<typeof vi.fn>> => ({
  alGrabar: vi.fn(), alTranscribir: vi.fn(), alResultado: vi.fn(), alFallar: vi.fn(), alPausar: vi.fn(), alCancelar: vi.fn(),
});

async function grabando(a: AvisosDeGrabadora): Promise<GrabadoraDeVoz> {
  const g = new GrabadoraDeVoz(a, true);
  g.empezar();
  await vi.advanceTimersByTimeAsync(0);
  return g;
}

beforeEach(() => {
  vi.useFakeTimers();
  ahora = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => ahora);
  vi.stubGlobal('MediaRecorder', GrabadoraFalsa);
  vi.stubGlobal('navigator', { userAgent: 'Firefox', mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [pista] })) } });
  pista.stop.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const pasar = async (ms: number) => {
  ahora += ms;
  await vi.advanceTimersByTimeAsync(ms);
};

describe('GrabadoraDeVoz · tiempo y pausas', () => {
  it('el contador sube mientras graba y se congela en la pausa', async () => {
    const a = avisos();
    const g = await grabando(a);
    expect(a.alGrabar).toHaveBeenCalled();
    await pasar(5_000);
    expect(g.segundos).toBeCloseTo(5, 1);
    g.pausar();
    expect(GrabadoraFalsa.ultima.state).toBe('paused');
    expect(a.alPausar).toHaveBeenLastCalledWith(true);
    await pasar(10_000);
    expect(g.segundos).toBeCloseTo(5, 1);
    g.reanudar();
    expect(GrabadoraFalsa.ultima.state).toBe('recording');
    expect(a.alPausar).toHaveBeenLastCalledWith(false);
    await pasar(2_000);
    expect(g.segundos).toBeCloseTo(7, 1);
  });

  it('el tope de 45 s cuenta solo lo grabado: una pausa larga no lo consume', async () => {
    const a = avisos();
    const g = await grabando(a);
    await pasar(40_000);
    g.pausar();
    await pasar(120_000);
    expect(a.alTranscribir).not.toHaveBeenCalled();
    g.reanudar();
    await pasar(4_000);
    expect(a.alTranscribir).not.toHaveBeenCalled();
    await pasar(1_100);
    expect(a.alTranscribir).toHaveBeenCalledWith(true);
    expect(SEGUNDOS_MAXIMOS_DE_GRABACION).toBe(45);
  });

  it('terminar estando en pausa también manda a transcribir lo grabado', async () => {
    const a = avisos();
    const g = await grabando(a);
    await pasar(3_000);
    g.pausar();
    g.terminar(false);
    expect(a.alTranscribir).toHaveBeenCalledWith(false);
    expect(GrabadoraFalsa.ultima.state).toBe('inactive');
  });

  it('pausar o reanudar sin una grabación en curso no hace nada', () => {
    const a = avisos();
    const g = new GrabadoraDeVoz(a, true);
    g.pausar();
    g.reanudar();
    expect(a.alPausar).not.toHaveBeenCalled();
    expect(g.segundos).toBe(0);
  });
});

describe('GrabadoraDeVoz · cancelar', () => {
  it('cancelar apaga el micrófono, no transcribe nada y avisa', async () => {
    const a = avisos();
    const g = await grabando(a);
    await pasar(3_000);
    g.cancelar();
    expect(pista.stop).toHaveBeenCalled();
    expect(a.alCancelar).toHaveBeenCalledTimes(1);
    expect(a.alTranscribir).not.toHaveBeenCalled();
    expect(a.alResultado).not.toHaveBeenCalled();
    expect(g.libre).toBe(true);
    await pasar(60_000);
    expect(a.alTranscribir).not.toHaveBeenCalled();
  });
});
