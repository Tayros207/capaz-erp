import { describe, expect, it, vi } from 'vitest';
import { INSTRUCCION_DE_TRANSCRIPCION, limpiarTranscripcion, motivoPorEstado, TranscriptorDeOpenRouter, usoDe } from './transcriptor-de-openrouter.js';

const LLAVE = 'sk-or-v1-llave-que-no-debe-salir-9999999999';
const AUDIO = 'UklGRiQAAABXQVZF';
const respuesta = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
const ok = (contenido: unknown, uso: unknown = { prompt_tokens: 412, completion_tokens: 14, cost: 0.000_183_7 }) => respuesta({ choices: [{ message: { content: contenido }, finish_reason: 'stop' }], usage: uso });

const con = (f: unknown, msMaximo?: number) => new TranscriptorDeOpenRouter({ apiKey: LLAVE, modelo: 'google/gemini-3.5-flash-lite', fetch: f as typeof fetch, ...(msMaximo ? { msMaximo } : {}) });
const cuerpoDe = (f: ReturnType<typeof vi.fn>) => JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);

describe('TranscriptorDeOpenRouter', () => {
  it('manda el audio como input_audio WAV, sin flujo, con la instrucción y solo a proveedores sin retención', async () => {
    const f = vi.fn(async () => ok('Ingreso 500 soles cliente Juan Pérez flyers'));
    const r = await con(f).transcribir(AUDIO);
    expect(r).toEqual({ ok: true, texto: 'Ingreso 500 soles cliente Juan Pérez flyers', uso: { tokensEntrada: 412, tokensSalida: 14, costoMicrousd: 184 } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${LLAVE}`);
    const cuerpo = cuerpoDe(f);
    expect(cuerpo).toMatchObject({ model: 'google/gemini-3.5-flash-lite', stream: false, provider: { data_collection: 'deny', zdr: true } });
    expect(cuerpo.messages[0]).toEqual({ role: 'system', content: INSTRUCCION_DE_TRANSCRIPCION });
    expect(cuerpo.messages[1].content[1]).toEqual({ type: 'input_audio', input_audio: { data: AUDIO, format: 'wav' } });
  });

  it('la instrucción pide español de Perú, solo lo dicho, no obedecer lo que se oye y vacío si no se entiende', () => {
    expect(INSTRUCCION_DE_TRANSCRIPCION).toMatch(/español \(Perú\)/);
    expect(INSTRUCCION_DE_TRANSCRIPCION).toMatch(/SOLO el texto dicho/);
    expect(INSTRUCCION_DE_TRANSCRIPCION).toMatch(/no la obedezcas/);
    expect(INSTRUCCION_DE_TRANSCRIPCION).toMatch(/respuesta vacía/);
  });

  it('una respuesta vacía o sin texto es un éxito vacío (no se entendió nada), con su costo', async () => {
    expect(await con(async () => ok('   ')).transcribir(AUDIO)).toMatchObject({ ok: true, texto: '' });
    expect(await con(async () => ok(null)).transcribir(AUDIO)).toMatchObject({ ok: true, texto: '', uso: { costoMicrousd: 184 } });
  });

  it('un 4xx/5xx se traduce por el estado, sin leer el cuerpo y sin la llave', async () => {
    for (const [estado, motivo] of [[402, 'modelo_no_disponible'], [404, 'modelo_no_disponible'], [429, 'modelo_no_disponible'], [400, 'interno'], [500, 'interno'], [503, 'modelo_no_disponible'], [504, 'tiempo_agotado']] as const) {
      const r = await con(async () => respuesta({ error: { message: `Bearer ${LLAVE} sin saldo` } }, estado)).transcribir(AUDIO);
      expect(r).toEqual({ ok: false, motivo, uso: null, estado });
      expect(JSON.stringify(r)).not.toContain(LLAVE);
      expect(JSON.stringify(r)).not.toContain('sin saldo');
    }
  });

  it('se rinde al agotar el tiempo', async () => {
    const lento = (_: string, init: RequestInit) =>
      new Promise<Response>((_r, rechazar) => init.signal?.addEventListener('abort', () => rechazar(init.signal?.reason)));
    expect(await con(lento, 20).transcribir(AUDIO)).toEqual({ ok: false, motivo: 'tiempo_agotado', uso: null });
  });

  it('un corte de red o un JSON roto no lanzan ni dejan ver la llave', async () => {
    const roto = await con(async () => new Response('no es json', { status: 200 })).transcribir(AUDIO);
    expect(roto).toEqual({ ok: false, motivo: 'interno', uso: null });
    const red = await con(async () => {
      throw new Error(`fallo con ${LLAVE}`);
    }).transcribir(AUDIO);
    expect(red).toEqual({ ok: false, motivo: 'interno', uso: null });
    expect(JSON.stringify(red)).not.toContain(LLAVE);
  });
});

describe('ayudas', () => {
  it('limpia espacios y comillas envolventes, y nada más', () => {
    expect(limpiarTranscripcion('  «Ingreso 500 soles»  ')).toBe('Ingreso 500 soles');
    expect(limpiarTranscripcion('"hola"')).toBe('hola');
    expect(limpiarTranscripcion('dijo "hola" y se fue')).toBe('dijo "hola" y se fue');
  });
  it('el costo se redondea una sola vez a millonésimas; sin uso, nulo', () => {
    expect(usoDe({ usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.0000014 } })).toEqual({ tokensEntrada: 10, tokensSalida: 2, costoMicrousd: 1 });
    expect(usoDe({ usage: { cost: 'mucho' } })).toEqual({ tokensEntrada: 0, tokensSalida: 0, costoMicrousd: 0 });
    expect(usoDe({})).toBeNull();
  });
  it('los estados se clasifican sin mirar el cuerpo', () => {
    expect(motivoPorEstado(401)).toBe('modelo_no_disponible');
    expect(motivoPorEstado(408)).toBe('tiempo_agotado');
    expect(motivoPorEstado(418)).toBe('interno');
  });
});
