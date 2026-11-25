import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorDeModelo, type PeticionDeModelo, type TrozoDeModelo } from './modelo-de-chat.js';
import { esfuerzoDeRazonamiento, MS_DE_SILENCIO, MS_PARA_CONECTAR, ModeloDeOpenRouter } from './modelo-de-openrouter.js';

// Ninguna prueba sale a la red: el `fetch` es de mentira y entrega flujos armados a mano.

const LLAVE = 'sk-or-llave-de-prueba-que-nunca-debe-aparecer';
const enc = new TextEncoder();
const dato = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const peticion = (o: Partial<PeticionDeModelo> = {}): PeticionDeModelo => ({ modelo: 'deepseek/x', mensajes: [{ role: 'user', content: 'hola' }], herramientas: [], senal: new AbortController().signal, sesion: 's1', ...o });

function respuestaDe(...trozos: string[]): Response {
  return new Response(new ReadableStream<Uint8Array>({ start(c) { for (const t of trozos) c.enqueue(enc.encode(t)); c.close(); } }), { status: 200 });
}
function modeloCon(fetchFalso: typeof fetch, razonamiento: 'none' | 'low' | 'high' = 'none') {
  return new ModeloDeOpenRouter({ apiKey: LLAVE, razonamiento, fetch: fetchFalso });
}
async function leer(m: ModeloDeOpenRouter, p = peticion()): Promise<TrozoDeModelo[]> {
  const salida: TrozoDeModelo[] = [];
  for await (const t of m.conversar(p)) salida.push(t);
  return salida;
}
const unaVez = (r: Response) => vi.fn<typeof fetch>(async () => r);

afterEach(() => vi.useRealTimers());

describe('ModeloDeOpenRouter · lectura del flujo', () => {
  it('entrega el texto por trozos y cierra con el uso: el costo pasa a millonésimas enteras', async () => {
    const f = unaVez(respuestaDe(
      ': OPENROUTER PROCESSING\n\n',
      dato({ choices: [{ delta: { content: 'Hola' } }] }),
      dato({ choices: [{ delta: { content: ' Moisés' } }] }),
      dato({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      dato({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 1000 }, cost: 0.000123 } }),
      'data: [DONE]\n\n',
    ));
    const t = await leer(modeloCon(f));
    expect(t.filter((x) => x.tipo === 'texto').map((x) => (x as { delta: string }).delta)).toEqual(['Hola', ' Moisés']);
    expect(t.at(-1)).toEqual({ tipo: 'fin', motivo: 'stop', llamadas: [], razonamiento: null, uso: { entrada: 1200, salida: 30, cache: 1000, costoMicrousd: 123 } });
    expect(Number.isInteger((t.at(-1) as { uso: { costoMicrousd: number } }).uso.costoMicrousd)).toBe(true);
  });

  it('junta las llamadas a herramientas que llegan en pedazos, por índice', async () => {
    const f = unaVez(respuestaDe(
      dato({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'pedidos_', arguments: '{"lim' } }] } }] }),
      dato({ choices: [{ delta: { tool_calls: [{ index: 1, id: 'c2', function: { name: 'clientes_buscar', arguments: '{"texto":"Ana"}' } }] } }] }),
      dato({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'listar', arguments: 'ite":5}' } }] } }] }),
      dato({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }),
    ));
    const fin = (await leer(modeloCon(f))).at(-1);
    expect(fin).toMatchObject({
      tipo: 'fin',
      motivo: 'tool_calls',
      llamadas: [
        { id: 'c1', type: 'function', function: { name: 'pedidos_listar', arguments: '{"limite":5}' } },
        { id: 'c2', type: 'function', function: { name: 'clientes_buscar', arguments: '{"texto":"Ana"}' } },
      ],
    });
  });

  it('una llamada sin argumentos queda con «{}» y no con texto vacío', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'mi_dia_ver' } }] }, finish_reason: 'tool_calls' }] })));
    expect((await leer(modeloCon(f))).at(-1)).toMatchObject({ llamadas: [{ function: { name: 'mi_dia_ver', arguments: '{}' } }] });
  });

  it('un error a mitad del flujo (HTTP 200) cierra la ronda como error', async () => {
    const f = unaVez(respuestaDe(
      dato({ choices: [{ delta: { content: 'Voy a' } }] }),
      dato({ error: { message: 'proveedor caído', code: 502 }, choices: [{ delta: {}, finish_reason: 'error' }] }),
    ));
    const t = await leer(modeloCon(f));
    expect(t.at(-1)).toMatchObject({ tipo: 'fin', motivo: 'error' });
  });

  it('un motivo de cierre desconocido (content_filter) se trata como error', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: { content: 'x' }, finish_reason: 'content_filter' }] })));
    expect((await leer(modeloCon(f))).at(-1)).toMatchObject({ motivo: 'error' });
  });

  it('el corte por longitud se informa como length', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: { content: 'x' }, finish_reason: 'length' }] })));
    expect((await leer(modeloCon(f))).at(-1)).toMatchObject({ motivo: 'length' });
  });

  it('guarda los detalles de razonamiento para devolverlos tal cual', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: { reasoning_details: [{ type: 'reasoning.text', text: 'pienso' }] }, finish_reason: 'stop' }] })));
    expect((await leer(modeloCon(f))).at(-1)).toMatchObject({ razonamiento: [{ type: 'reasoning.text', text: 'pienso' }] });
  });

  it('un flujo que termina SIN motivo de cierre se cortó a medias: es un error, no una respuesta completa', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: { content: 'Voy a' } }] })));
    expect((await leer(modeloCon(f))).at(-1)).toMatchObject({ tipo: 'fin', motivo: 'error' });
  });

  it('un cuerpo vacío tampoco es una respuesta completa', async () => {
    expect((await leer(modeloCon(unaVez(respuestaDe(': OPENROUTER PROCESSING\n\n'))))).at(-1)).toMatchObject({ motivo: 'error' });
  });

  it('ignora líneas de datos que no son JSON', async () => {
    const f = unaVez(respuestaDe('data: {roto\n\n', dato({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] })));
    expect((await leer(modeloCon(f))).map((x) => x.tipo)).toEqual(['texto', 'fin']);
  });
});

describe('ModeloDeOpenRouter · la petición', () => {
  async function cuerpoEnviado(m: ModeloDeOpenRouter, p: PeticionDeModelo, f: ReturnType<typeof unaVez>) {
    await leer(m, p);
    const [url, init] = f.mock.calls[0]!;
    return { url: url as string, init: init!, cuerpo: JSON.parse(init!.body as string) as Record<string, unknown> };
  }

  it('va a OpenRouter con la llave en la cabecera y con proveedores que no guardan datos', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: {}, finish_reason: 'stop' }] })));
    const { url, init, cuerpo } = await cuerpoEnviado(modeloCon(f), peticion(), f);
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${LLAVE}`);
    expect(cuerpo.provider).toEqual({ data_collection: 'deny', zdr: true, require_parameters: true });
    expect(cuerpo.stream).toBe(true);
    expect(cuerpo.max_tokens).toBe(2000);
    expect(cuerpo.model).toBe('deepseek/x');
  });

  it('el razonamiento sale como está configurado y no se mandan marcas de caché', async () => {
    const f = unaVez(respuestaDe(dato({ choices: [{ delta: {}, finish_reason: 'stop' }] })));
    const { cuerpo } = await cuerpoEnviado(modeloCon(f, 'low'), peticion(), f);
    expect(cuerpo.reasoning).toEqual({ effort: 'low' });
    expect(JSON.stringify(cuerpo)).not.toContain('cache_control');
    expect(JSON.stringify(cuerpo)).not.toContain('"usage"');
  });

  it('sin herramientas no manda tools ni tool_choice; con herramientas manda tool_choice auto', async () => {
    const f1 = unaVez(respuestaDe(dato({ choices: [{ delta: {}, finish_reason: 'stop' }] })));
    const sin = await cuerpoEnviado(modeloCon(f1), peticion(), f1);
    expect(sin.cuerpo).not.toHaveProperty('tools');
    expect(sin.cuerpo).not.toHaveProperty('tool_choice');
    const f2 = unaVez(respuestaDe(dato({ choices: [{ delta: {}, finish_reason: 'stop' }] })));
    const con = await cuerpoEnviado(modeloCon(f2), peticion({ herramientas: [{ type: 'function', function: { name: 'x' } }] }), f2);
    expect(con.cuerpo.tool_choice).toBe('auto');
    expect(con.cuerpo.tools).toHaveLength(1);
  });
});

describe('ModeloDeOpenRouter · fallos', () => {
  const conEstado = (estado: number, cuerpo = 'detalle interno del proveedor') =>
    vi.fn<typeof fetch>(async () => new Response(cuerpo, { status: estado }));

  it.each([
    [503, 'modelo_no_disponible'],
    [404, 'modelo_no_disponible'],
    [429, 'modelo_no_disponible'],
    [402, 'modelo_no_disponible'],
    [504, 'tiempo_agotado'],
    [500, 'interno'],
    [401, 'interno'],
  ] as const)('HTTP %i → %s, sin filtrar ni la llave ni el cuerpo del proveedor', async (estado, motivo) => {
    const e = await leer(modeloCon(conEstado(estado))).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErrorDeModelo);
    expect((e as ErrorDeModelo).motivo).toBe(motivo);
    expect(String(e)).not.toContain(LLAVE);
    expect(String(e)).not.toContain('detalle interno');
  });

  it('un fallo de red se informa como interno, sin filtrar la llave', async () => {
    const f = vi.fn<typeof fetch>(async () => { throw new TypeError(`fallo con ${LLAVE}`); });
    const e = await leer(modeloCon(f)).catch((x: unknown) => x);
    expect((e as ErrorDeModelo).motivo).toBe('interno');
    expect(String(e)).not.toContain(LLAVE);
  });

  it('si la persona corta el turno, el motivo es «cancelado»', async () => {
    const c = new AbortController();
    const f = vi.fn<typeof fetch>((_url, init) => new Promise((_ok, no) => init!.signal!.addEventListener('abort', () => no(new DOMException('abortado', 'AbortError')))));
    const pendiente = leer(modeloCon(f), peticion({ senal: c.signal }));
    const asercion = expect(pendiente).rejects.toMatchObject({ motivo: 'cancelado' });
    c.abort();
    await asercion;
  });
});

describe('ModeloDeOpenRouter · tiempos', () => {
  it('si no hay respuesta en 30 s, aborta con «tiempo agotado»', async () => {
    vi.useFakeTimers();
    const f = vi.fn<typeof fetch>((_url, init) => new Promise((_ok, no) => init!.signal!.addEventListener('abort', () => no(new DOMException('abortado', 'AbortError')))));
    const pendiente = leer(modeloCon(f));
    const asercion = expect(pendiente).rejects.toMatchObject({ motivo: 'tiempo_agotado' });
    await vi.advanceTimersByTimeAsync(MS_PARA_CONECTAR - 1);
    await vi.advanceTimersByTimeAsync(2);
    await asercion;
  });

  it('los comentarios de «sigo vivo» del proveedor también rearman el reloj: un modelo en cola no se aborta', async () => {
    vi.useFakeTimers();
    let controlador!: ReadableStreamDefaultController<Uint8Array>;
    const f = vi.fn<typeof fetch>(async (_url, init) => {
      const cuerpo = new ReadableStream<Uint8Array>({ start(c) { controlador = c; c.enqueue(enc.encode(': OPENROUTER PROCESSING\n\n')); } });
      init!.signal!.addEventListener('abort', () => controlador.error(new DOMException('abortado', 'AbortError')));
      return new Response(cuerpo, { status: 200 });
    });
    let fallo: unknown = null;
    const pendiente = (async () => { try { for await (const _t of modeloCon(f).conversar(peticion())) { /* nada */ } } catch (e) { fallo = e; } })();
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(MS_DE_SILENCIO - 5_000);
      controlador.enqueue(enc.encode(': OPENROUTER PROCESSING\n\n'));
    }
    await vi.advanceTimersByTimeAsync(1_000);
    expect(fallo).toBeNull(); // casi tres minutos en cola y sigue vivo
    await vi.advanceTimersByTimeAsync(MS_DE_SILENCIO);
    await pendiente;
    expect(fallo).toMatchObject({ motivo: 'tiempo_agotado' });
  });

  it('si el flujo se queda mudo 60 s a mitad de ronda, aborta; mientras llegan trozos no', async () => {
    vi.useFakeTimers();
    let controlador!: ReadableStreamDefaultController<Uint8Array>;
    const f = vi.fn<typeof fetch>(async (_url, init) => {
      const cuerpo = new ReadableStream<Uint8Array>({ start(c) { controlador = c; c.enqueue(enc.encode(dato({ choices: [{ delta: { content: 'Hola' } }] }))); } });
      init!.signal!.addEventListener('abort', () => controlador.error(new DOMException('abortado', 'AbortError')));
      return new Response(cuerpo, { status: 200 });
    });
    const recibidos: TrozoDeModelo[] = [];
    const pendiente = (async () => { for await (const t of modeloCon(f).conversar(peticion())) recibidos.push(t); })();
    const asercion = expect(pendiente).rejects.toMatchObject({ motivo: 'tiempo_agotado' });
    await vi.advanceTimersByTimeAsync(MS_DE_SILENCIO - 5_000);
    controlador.enqueue(enc.encode(dato({ choices: [{ delta: { content: ' de nuevo' } }] })));
    await vi.advanceTimersByTimeAsync(MS_DE_SILENCIO - 5_000); // llegó un trozo: el reloj se reinició
    expect(recibidos.map((x) => (x as { delta: string }).delta)).toEqual(['Hola', ' de nuevo']);
    await vi.advanceTimersByTimeAsync(10_000);
    await asercion;
  });
});

describe('esfuerzoDeRazonamiento', () => {
  it('con «ninguno», los modelos de Anthropic piden «bajo» (lo exigen) y el resto sigue sin razonar', () => {
    expect(esfuerzoDeRazonamiento('anthropic/claude-sonnet-5.5', 'none')).toBe('low');
    expect(esfuerzoDeRazonamiento('deepseek/deepseek-v4.1-flash-1017', 'none')).toBe('none');
  });
  it('lo que la empresa configuró de forma explícita se respeta', () => {
    expect(esfuerzoDeRazonamiento('anthropic/claude-opus-5.5', 'high')).toBe('high');
    expect(esfuerzoDeRazonamiento('deepseek/x', 'low')).toBe('low');
  });
});
